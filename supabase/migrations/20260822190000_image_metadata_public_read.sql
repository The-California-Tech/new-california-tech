-- Fixes the silent-NULL bug on homepage.cover_width / homepage.cover_height.
--
-- HISTORICAL NOTE: public.homepage was dropped two migrations later, in
-- 20260822190300, and its query moved into list_homepage_posts(). The grants on
-- the view below are therefore transient -- they apply cleanly because the view
-- still exists at this point in the sequence. The RLS fix on image_metadata is
-- the durable part of this migration and still matters: the function's LEFT JOIN
-- hits the same permission wall the view did.
--
-- Background:
--   public.homepage is defined WITH (security_invoker = on), so every base
--   relation in the view is evaluated as the *caller* under the caller's RLS.
--   20260616035324_remote_schema.sql enabled RLS on public.image_metadata and
--   gave it exactly one policy ("Service role full access"). RLS default-denies,
--   so for role `anon` the LEFT JOIN in the homepage view matched zero rows and
--   cover_width / cover_height came back NULL -- with no error anywhere, because
--   a LEFT JOIN finding nothing is not an error.
--
--   anon already holds a table-level SELECT grant (remote_schema.sql:11), so
--   this was never a privilege problem. It was a missing permissive policy.
--
-- Note on the alternative fix: dropping `security_invoker` from the homepage
-- view would also "work", but the view would then run as its owner and bypass
-- RLS on public.pages too -- exposing unpublished and future-scheduled articles.
-- Do not do that.

-- 1) Let anon/authenticated read image dimensions.
--    Image width/height carry no confidential information; the rows are keyed by
--    the public storage path of an already-public object.
drop policy if exists "Public image metadata read" on public.image_metadata;

create policy "Public image metadata read"
  on public.image_metadata
  as permissive
  for select
  to anon, authenticated
  using (true);

-- 2) Narrow the write grants anon/authenticated inherited from Supabase's
--    default privileges. RLS already blocks these writes (no policy permits
--    them), so this is defense in depth rather than a behavior change. Sync
--    writes use the service role, which is unaffected.
-- TRUNCATE/REFERENCES/TRIGGER are included because Supabase's ALTER DEFAULT
-- PRIVILEGES on `public` may have granted them at CREATE TABLE time even though
-- the pulled remote_schema migration only lists the four DML privileges. Note
-- TRUNCATE is not subject to RLS, so it is not covered by the policies above.
revoke insert, update, delete, truncate, references, trigger
  on table public.image_metadata from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.image_metadata from authenticated;
revoke truncate, references, trigger
  on table public.image_metadata from service_role;

-- 3) Make the homepage view's read grant explicit.
--    Nothing in the migration history ever granted SELECT on public.homepage --
--    it works today only because of Supabase's ALTER DEFAULT PRIVILEGES on the
--    public schema. A clean `supabase db reset`, or a freshly provisioned
--    project, would 401 on the homepage feed. Pin it down.
grant select on table public.homepage to anon;
grant select on table public.homepage to authenticated;
grant select on table public.homepage to service_role;

-- 4) list_unique_tags was created in 20260615035002 without execute grants
--    (the declarative schema file has them, the migration does not). Same
--    latent clean-environment failure.
grant execute on function public.list_unique_tags(text) to anon;
grant execute on function public.list_unique_tags(text) to authenticated;

-- 5) Lock down list_storage_objects_recursive.
--
--    Postgres grants EXECUTE on new functions to PUBLIC by default, and anon
--    inherits that. 20260619011255 deliberately added no grants, assuming that
--    meant "service role only" -- it did not. anon could call it.
--
--    The function is not SECURITY DEFINER, so a caller is still subject to RLS
--    on storage.objects. But the `media` bucket is public, so any policy that
--    lets the web client read objects also lets it *enumerate* them. That turns
--    the whole bucket into a directory listing: unlinked files, including issue
--    PDFs uploaded before their release date, become discoverable.
--
--    Enumeration is a different capability from fetching a known URL. Revoke it.
revoke all on function public.list_storage_objects_recursive(text, text, integer, text) from public;
revoke all on function public.list_storage_objects_recursive(text, text, integer, text) from anon;
revoke all on function public.list_storage_objects_recursive(text, text, integer, text) from authenticated;
grant execute on function public.list_storage_objects_recursive(text, text, integer, text) to service_role;

-- Same default-PUBLIC-execute issue. A trigger function called directly errors
-- out rather than doing damage, but there is no reason for it to be reachable.
revoke all on function public.set_updated_at() from public;
revoke all on function public.set_updated_at() from anon;
revoke all on function public.set_updated_at() from authenticated;

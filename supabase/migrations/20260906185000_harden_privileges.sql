-- Hand-written follow-up to the generated baseline. KEEP THIS FILE when
-- regenerating the baseline (`git checkout` it after `rm migrations/*.sql`).
--
-- Now that 20260906184900_default_privileges.sql revokes the automatic grants,
-- this file is down to two jobs: (1) things the diff engine omits entirely, and
-- (2) a one-time cleanup of objects that already existed on the hosted project
-- and therefore still carry the old shotgun grants.
--
-- Both are documented Supabase caveats, not bugs to route around:
-- https://supabase.com/docs/guides/local-development/declarative-database-schemas#known-caveats

-- ---------------------------------------------------------------------------
-- (1a) Extensions the baseline omitted
--
-- The generated baseline emitted hypopg and index_advisor but not pg_net, which
-- the old migration chain did create (dropped in 20260120013952, re-created in
-- 20260120022203). Declared explicitly so a fresh `db reset` matches production.
-- ---------------------------------------------------------------------------
create extension if not exists "pg_net" with schema "extensions";

-- ---------------------------------------------------------------------------
-- (1b) Function EXECUTE grants
--
-- The baseline emits table grants but no function grants, because at generation
-- time PUBLIC still held EXECUTE and so granting to anon was a no-op the differ
-- had nothing to say about. With the PUBLIC default now revoked these are load-
-- bearing: without them PostgREST returns 42501 and the feed returns nothing.
--
-- GRANT is idempotent, so it is harmless if a future baseline also emits them.
-- ---------------------------------------------------------------------------
-- REVOKE-then-GRANT on every function, rather than trusting ALTER DEFAULT
-- PRIVILEGES to have suppressed Postgres's PUBLIC=EXECUTE default. That default
-- proved unreliable to suppress in practice: `pg_default_acl` showed PUBLIC's
-- EXECUTE removed for role postgres, yet a freshly created function was still
-- executable by anon. Rather than chase it, state each function's ACL outright --
-- deterministic, greppable, and independent of how defaults behave.
--
-- feed_sql_checks.sql check 3c asserts the resulting exposure surface is exactly
-- these three functions.
revoke all on function public.list_homepage_posts(text, text, date, integer, integer) from public;
grant execute on function public.list_homepage_posts(text, text, date, integer, integer) to anon;
grant execute on function public.list_homepage_posts(text, text, date, integer, integer) to authenticated;
grant execute on function public.list_homepage_posts(text, text, date, integer, integer) to service_role;

revoke all on function public.nearest_issue_date(date) from public;
grant execute on function public.nearest_issue_date(date) to anon;
grant execute on function public.nearest_issue_date(date) to authenticated;
grant execute on function public.nearest_issue_date(date) to service_role;

revoke all on function public.list_unique_tags(text) from public;
grant execute on function public.list_unique_tags(text) to anon;
grant execute on function public.list_unique_tags(text) to authenticated;
grant execute on function public.list_unique_tags(text) to service_role;

-- Deliberately NOT granted to anon/authenticated: list_storage_objects_recursive
-- enumerates the public `media` bucket, which would expose unlinked files such
-- as issue PDFs uploaded before their release date. Enumeration is a distinct
-- capability from fetching a known URL. Service role only.
grant execute on function public.list_storage_objects_recursive(text, text, integer, text) to service_role;

-- set_updated_at is a trigger function; nothing should call it directly.
-- (No grant. The revoked PUBLIC default means it is already unreachable.)

-- ---------------------------------------------------------------------------
-- (2) One-time cleanup for pre-existing objects
--
-- ALTER DEFAULT PRIVILEGES only affects objects created *after* it runs. On the
-- hosted project, public.pages and public.image_metadata were created back in
-- January and June under the old defaults, so they still hold the full DML set
-- for anon and authenticated. These revokes are what actually strips them.
--
-- On a fresh `db reset` they are no-ops -- the baseline creates those tables
-- with defaults already off -- but they must stay for the hosted database, and
-- for anyone cloning this repo against an older project.
--
-- TRUNCATE is the one that matters: it is NOT subject to RLS, so the usual
-- "policies protect us" reasoning does not cover it.
-- ---------------------------------------------------------------------------
revoke insert, update, delete, truncate, references, trigger
  on table public.pages from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.pages from authenticated;
revoke truncate, references, trigger
  on table public.pages from service_role;

revoke insert, update, delete, truncate, references, trigger
  on table public.image_metadata from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.image_metadata from authenticated;
revoke truncate, references, trigger
  on table public.image_metadata from service_role;

revoke all on function public.list_storage_objects_recursive(text, text, integer, text) from public;
revoke all on function public.list_storage_objects_recursive(text, text, integer, text) from anon;
revoke all on function public.list_storage_objects_recursive(text, text, integer, text) from authenticated;

revoke all on function public.set_updated_at() from public;
revoke all on function public.set_updated_at() from anon;
revoke all on function public.set_updated_at() from authenticated;

-- Re-assert the reads the site needs, in case a revoke above overreached.
grant select on table public.pages to anon;
grant select on table public.pages to authenticated;
grant select, insert, update, delete on table public.pages to service_role;

grant select on table public.image_metadata to anon;
grant select on table public.image_metadata to authenticated;
grant select, insert, update, delete on table public.image_metadata to service_role;

-- Pin search_path on public.set_updated_at.
--
-- Flagged by Supabase's database linter as `function_search_path_mutable`:
--   https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable
--
-- A function with no explicit search_path resolves unqualified object references
-- using the CALLER's search_path. For a SECURITY DEFINER function that is a
-- privilege-escalation vector; this one is SECURITY INVOKER, so the exposure is
-- much smaller -- but it is a trigger that fires on every UPDATE of
-- public.image_metadata and calls an unqualified now(), which is shadowable by
-- anything the caller can put earlier in its path.
--
-- It was the only function in the schema still missing one: everything added in
-- September already sets search_path explicitly. It predates that work, having
-- come over verbatim from 20260616025819_image_metadata.sql.
--
-- `search_path = ''` is the strictest option -- nothing resolves implicitly -- so
-- now() has to be written as pg_catalog.now(). `new` is a PL/pgSQL record
-- variable, not a schema object, so it needs no qualification.
--
-- CREATE OR REPLACE keeps the existing trigger binding intact; no need to drop
-- and recreate trg_image_metadata_set_updated_at.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

-- CREATE OR REPLACE resets the ACL to the default (EXECUTE to PUBLIC), so the
-- revokes have to be reapplied. This is the same trap that makes
-- _harden_privileges.sql permanent: privileges do not survive a function
-- redefinition, and nothing in the diff tooling will tell you.
revoke all on function public.set_updated_at() from public;
revoke all on function public.set_updated_at() from anon;
revoke all on function public.set_updated_at() from authenticated;

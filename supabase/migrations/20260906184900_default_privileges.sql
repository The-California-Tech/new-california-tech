-- Turn off Supabase's automatic grants on future objects in `public`.
--
-- TIMESTAMP IS DELIBERATELY EARLIER THAN THE BASELINE. ALTER DEFAULT PRIVILEGES
-- only affects objects created *after* it runs, so this must be the first
-- migration. If you regenerate the baseline, keep this one sorting ahead of it.
--
-- WHY
--   By default Supabase runs ALTER DEFAULT PRIVILEGES on the `public` schema so
--   that every new table is granted select/insert/update/delete to anon,
--   authenticated and service_role, and Postgres itself grants EXECUTE on every
--   new function to PUBLIC. That is how `anon` came to hold TRUNCATE on
--   public.pages (TRUNCATE is not subject to RLS) and EXECUTE on
--   list_storage_objects_recursive (which enumerates a public bucket).
--
--   It is also why the declarative workflow could not own privileges: the diff
--   engine models them additively, so it can emit GRANT but has no way to say
--   "PUBLIC must not hold the default it was born with". Every regenerated
--   baseline silently dropped our REVOKEs, and `db diff` reported
--   "No schema changes found" while doing it -- it is blind in both directions.
--
--   Revoking the defaults inverts the problem. With no automatic grants, the only
--   privilege statements needed are GRANTs, which the diff engine *can* express.
--   Privileges become declarative for everything created from here on.
--
-- ALIGNMENT
--   This is Supabase's own opt-in snippet for the breaking change announced
--   2026-04-28: automatic Data API exposure of new `public` tables is already the
--   default-off for new projects as of 2026-05-30, and is enforced on ALL
--   existing projects on 2026-10-30. Adopting it now means that date is a no-op
--   here instead of a surprise. Existing objects keep their grants either way --
--   see _harden_privileges.sql for the one-time cleanup of those.
--
--   Ref: https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically
--
-- NOTE: these statements are mirrored at the top of schemas/10_symbiont_core.sql.
-- They must exist in BOTH places. `db diff` builds one database from migrations
-- and another from the schema files, then compares object privileges; if only one
-- side has the defaults revoked, every table's grants differ and the diff is
-- permanently noisy. ALTER DEFAULT PRIVILEGES is not itself a schema object, so
-- the differ never emits it -- it only sees the consequences.

-- TWO CORRECTIONS TO SUPABASE'S PUBLISHED SNIPPET, both found by running it:
--
--   1. WRONG ROLE. Their snippet says `for role postgres`, but on a local stack
--      the default ACLs are registered against `supabase_admin`:
--          anon=arwdDxtm/supabase_admin
--      Default privileges are keyed to the *creating* role, so revoking them for
--      `postgres` leaves supabase_admin's entry untouched. Which role holds them
--      varies between local and hosted, so discover it rather than assume.
--
--   2. INCOMPLETE PRIVILEGE LIST. Their snippet revokes select/insert/update/
--      delete. The actual grant is `arwdDxtm` -- which also includes D (TRUNCATE,
--      the one that bypasses RLS), x (REFERENCES), t (TRIGGER) and m (MAINTAIN).
--      `revoke all` is used below instead of enumerating.
--
-- The loop is wrapped in an exception handler because on the hosted project
-- `postgres` is not a superuser and may not be permitted to alter another role's
-- default privileges. A warning there is correct behaviour: the one-time explicit
-- revokes in _harden_privileges.sql still protect the existing tables, and
-- feed_sql_checks.sql check 3b will fail loudly if new tables end up exposed.
do $$
declare
  r record;
begin
  for r in
    select distinct pg_get_userbyid(d.defaclrole) as rolename
    from pg_default_acl d
    join pg_namespace n on n.oid = d.defaclnamespace
    where n.nspname = 'public'
  loop
    begin
      execute format(
        'alter default privileges for role %I in schema public
           revoke all on tables from anon, authenticated, service_role', r.rolename);
      execute format(
        'alter default privileges for role %I in schema public
           revoke all on sequences from anon, authenticated, service_role', r.rolename);
      -- Postgres, not Supabase, is the source of the function default: every new
      -- function grants EXECUTE to PUBLIC. Functions the site actually calls are
      -- granted explicitly in _harden_privileges.sql.
      execute format(
        'alter default privileges for role %I in schema public
           revoke all on functions from public', r.rolename);
      execute format(
        'alter default privileges for role %I in schema public
           revoke all on functions from anon, authenticated, service_role', r.rolename);

      raise notice 'default privileges revoked for role %', r.rolename;
    exception
      when insufficient_privilege then
        raise warning
          'could not alter default privileges for role % (insufficient privilege) -- check feed_sql_checks 3b', r.rolename;
    end;
  end loop;
end $$;

-- Also pin it for `postgres` explicitly. Migrations and the SQL editor run as
-- postgres, so this is the role that creates tables in practice; if it has no
-- entry in pg_default_acl today, an ALTER DEFAULT PRIVILEGES elsewhere could add
-- a permissive one later.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke all on functions from public;

alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated, service_role;

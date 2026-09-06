-- Narrow the grants on public.pages to what is actually used.
--
-- 20260120013322_create_symbiont_table.sql granted DELETE, INSERT, REFERENCES,
-- SELECT, TRIGGER, TRUNCATE and UPDATE to anon, authenticated AND service_role.
-- That is Supabase's default-privileges shotgun, not a considered decision, and
-- it went unnoticed because RLS masks most of it.
--
-- THE ONE THAT MATTERS: anon held TRUNCATE. **TRUNCATE is not subject to RLS** --
-- row-level policies govern SELECT/INSERT/UPDATE/DELETE only. So the usual "RLS
-- protects us" reasoning does not apply to it.
--
-- Not remotely exploitable as things stand: PostgREST exposes no TRUNCATE verb,
-- and `anon` is a role assumed via JWT rather than a login role, so there is no
-- direct SQL path to it. The exposure would be a SECURITY INVOKER function that
-- truncates -- none exists today. Still, it is a grant nobody intended, on the
-- table holding all published content, and it is free to remove.
--
-- Checked before writing this: symbiont-cms never issues TRUNCATE. The `wipe`
-- sync option calls pageCrud.deleteForSource(), a scoped DELETE, so service_role
-- keeps DELETE and wipe keeps working.
--
-- End state:
--   anon, authenticated  -> SELECT only (reads are further filtered by RLS)
--   service_role         -> SELECT, INSERT, UPDATE, DELETE (sync + wipe)

-- anon: read-only.
revoke insert, update, delete, truncate, references, trigger
  on table public.pages from anon;
grant select on table public.pages to anon;

-- authenticated: read-only. No authenticated-write feature exists.
revoke insert, update, delete, truncate, references, trigger
  on table public.pages from authenticated;
grant select on table public.pages to authenticated;

-- service_role: everything sync needs, minus the three it never uses.
revoke truncate, references, trigger
  on table public.pages from service_role;
grant select, insert, update, delete on table public.pages to service_role;

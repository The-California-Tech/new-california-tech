-- Production verification. READ ONLY, and returns a RESULT SET.
--
-- HOW TO RUN
--   Supabase dashboard -> SQL Editor -> paste -> Run. Results appear in the grid.
--   Also works in psql.
--
--   An earlier version of this file used RAISE NOTICE. Don't: the Supabase SQL
--   Editor renders result sets and errors only -- notices are silently dropped,
--   so the checks appear to produce nothing at all. Anything meant to be read in
--   the dashboard has to come back as rows.
--
-- WHAT IT DOES NOT DO
--   No INSERT/UPDATE/DELETE/CREATE/DROP. It reads catalogue tables only, so it
--   is safe against the database holding the paper's real content.
--   feed_sql_checks.sql is the behavioural suite -- it seeds synthetic rows
--   (inside a rolled-back transaction) and belongs on local + CI, not here.
--
-- READING THE OUTPUT
--   Every row should say OK. FAIL rows sort to the top. NOTE is advisory.

with facts as (
  select
    exists (
      select 1 from pg_views where schemaname = 'public' and viewname = 'homepage'
    ) as homepage_view_exists,

    (
      select coalesce(string_agg(f.name, ', '), '')
      from unnest(array['list_homepage_posts','nearest_issue_date','list_unique_tags']) as f(name)
      where not exists (
        select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = f.name
      )
    ) as missing_fns,

    (
      select coalesce(string_agg(p.proname, ', '), '')
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef
        and p.proname = any(array['list_homepage_posts','nearest_issue_date','list_unique_tags'])
    ) as secdef_fns,

    exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'image_metadata'
        and cmd in ('SELECT','ALL') and 'anon' = any(roles)
    ) as anon_can_read_image_metadata,

    -- Any write privilege anon/authenticated still hold. TRUNCATE matters most:
    -- it is NOT subject to RLS, so row policies do not cover it.
    (
      select coalesce(string_agg(format('%s.%s=%s', g.rolename, g.tbl, g.priv), ', '), '')
      from (
        select r.rolename, t.tbl, pr.priv
        from unnest(array['anon','authenticated']) as r(rolename)
        cross join unnest(array['pages','image_metadata']) as t(tbl)
        cross join unnest(array['INSERT','UPDATE','DELETE','TRUNCATE']) as pr(priv)
        where has_table_privilege(r.rolename, format('public.%I', t.tbl), pr.priv)
      ) g
    ) as anon_write_grants,

    (
      select coalesce(string_agg(format('%s.%s', t.tbl, 'SELECT'), ', '), '')
      from unnest(array['pages','image_metadata']) as t(tbl)
      where not has_table_privilege('anon', format('public.%I', t.tbl), 'SELECT')
    ) as anon_missing_reads,

    (
      has_table_privilege('service_role','public.pages','INSERT')
      and has_table_privilege('service_role','public.pages','DELETE')
      and has_table_privilege('service_role','public.pages','UPDATE')
    ) as service_role_can_sync,

    -- Every anon-executable function in `public` is a live PostgREST endpoint.
    (
      select coalesce(string_agg(format('%s(%s)', p.proname, pg_get_function_arguments(p.oid)), ', '), '')
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prokind = 'f'
        and not (p.proname = any(array['list_homepage_posts','nearest_issue_date','list_unique_tags']))
        and has_function_privilege('anon', p.oid, 'EXECUTE')
    ) as leaked_rpcs,

    (
      select coalesce(string_agg(f.name, ', '), '')
      from unnest(array['list_homepage_posts','nearest_issue_date','list_unique_tags']) as f(name)
      where not exists (
        select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = f.name
          and has_function_privilege('anon', p.oid, 'EXECUTE')
      )
    ) as unreachable_rpcs,

    exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'list_homepage_posts'
        and p.prosrc like '%supabase.co%'
    ) as cover_join_host_pinned,

    (
      select coalesce(string_agg(format('%s/%s', pg_get_userbyid(d.defaclrole), d.defaclobjtype), ', '), '')
      from pg_default_acl d
      join pg_namespace n on n.oid = d.defaclnamespace
      where n.nspname = 'public'
        and d.defaclobjtype in ('r','S')
        and d.defaclacl::text ~ '(anon|authenticated)=[arwdDxtm]'
    ) as permissive_default_acls,

    -- Supabase's linter rule `function_search_path_mutable`. A function with no
    -- pinned search_path resolves unqualified references using the CALLER's
    -- path. proconfig is null when nothing is SET on the function.
    (
      select coalesce(string_agg(p.proname, ', '), '')
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.prokind in ('f','p')
        and not exists (
          select 1 from unnest(coalesce(p.proconfig, '{}')) as cfg
          where cfg like 'search\_path=%'
        )
    ) as fns_without_search_path
),
checks as (
  -- `check_name`, not `check`: CHECK is a reserved word. Postgres tolerates it
  -- as an alias after AS, but referencing it unquoted later is a syntax error.
  select 1 as ord, 'homepage view dropped' as check_name,
         case when homepage_view_exists then 'FAIL' else 'OK' end as status,
         case when homepage_view_exists
              then 'public.homepage still exists; the catch-up migration should have dropped it'
              else 'gone; its query lives in list_homepage_posts()' end as detail
  from facts
  union all
  select 2, 'feed functions exist',
         case when missing_fns = '' then 'OK' else 'FAIL' end,
         case when missing_fns = '' then 'list_homepage_posts, nearest_issue_date, list_unique_tags'
              else 'MISSING: ' || missing_fns || ' -- the feed will 500' end
  from facts
  union all
  select 3, 'feed functions are SECURITY INVOKER',
         case when secdef_fns = '' then 'OK' else 'FAIL' end,
         case when secdef_fns = '' then 'RLS on public.pages is enforced for callers'
              else 'SECURITY DEFINER: ' || secdef_fns || ' -- RLS bypassed, embargoed articles would leak' end
  from facts
  union all
  select 4, 'anon can read image_metadata',
         case when anon_can_read_image_metadata then 'OK' else 'FAIL' end,
         case when anon_can_read_image_metadata then 'cover_width/cover_height will populate'
              else 'no permissive SELECT policy -- cover dimensions return NULL silently (the original production bug)' end
  from facts
  union all
  select 5, 'anon has required reads',
         case when anon_missing_reads = '' then 'OK' else 'FAIL' end,
         case when anon_missing_reads = '' then 'SELECT on pages + image_metadata'
              else 'MISSING: ' || anon_missing_reads end
  from facts
  union all
  select 6, 'anon has no write grants',
         case when anon_write_grants = '' then 'OK' else 'FAIL' end,
         case when anon_write_grants = '' then 'read-only, including no TRUNCATE'
              else 'STILL GRANTED: ' || anon_write_grants || '  (TRUNCATE is not subject to RLS)' end
  from facts
  union all
  select 7, 'service_role can still sync',
         case when service_role_can_sync then 'OK' else 'FAIL' end,
         case when service_role_can_sync then 'INSERT/UPDATE/DELETE on pages'
              else 'lost a privilege -- Notion sync and `wipe` will break' end
  from facts
  union all
  select 8, 'no unintended RPC exposure',
         case when leaked_rpcs = '' then 'OK' else 'FAIL' end,
         case when leaked_rpcs = '' then 'only the three feed functions are anon-executable'
              else 'anon can execute: ' || leaked_rpcs ||
                   '  (list_storage_objects_recursive would let the public enumerate the media bucket)' end
  from facts
  union all
  select 9, 'intended RPCs are reachable',
         case when unreachable_rpcs = '' then 'OK' else 'FAIL' end,
         case when unreachable_rpcs = '' then 'anon can execute all three'
              else 'anon CANNOT execute: ' || unreachable_rpcs || ' -- PostgREST returns 42501, feed is empty' end
  from facts
  union all
  select 10, 'cover join is host-agnostic',
         case when cover_join_host_pinned then 'FAIL' else 'OK' end,
         case when cover_join_host_pinned
              then 'list_homepage_posts hardcodes a Supabase host -- breaks on any other project'
              else 'matches on the storage path segment only' end
  from facts
  union all
  select 12, 'functions pin search_path',
         case when fns_without_search_path = '' then 'OK' else 'FAIL' end,
         case when fns_without_search_path = ''
              then 'no function resolves names via the caller''s search_path'
              else 'MUTABLE search_path: ' || fns_without_search_path ||
                   '  (Supabase linter: function_search_path_mutable)' end
  from facts
  union all
  -- Advisory: on the hosted project `postgres` is not a superuser and cannot
  -- alter supabase_admin's default privileges, so this may legitimately remain.
  -- Existing tables are already locked down by check 6; the gap is only that a
  -- NEW table created by the affected role would be auto-exposed.
  select 11, 'default privileges revoked',
         case when permissive_default_acls = '' then 'OK' else 'NOTE' end,
         case when permissive_default_acls = ''
              then 'new objects are not auto-exposed'
              else 'still permissive for ' || permissive_default_acls ||
                   ' -- run in SQL Editor: alter default privileges for role <role> in schema public revoke all on tables from anon, authenticated, service_role;' end
  from facts
)
-- `as flag`, not `as ""` -- Postgres rejects a zero-length delimited identifier
-- with "42601: zero-length delimited identifier".
select
  case status when 'FAIL' then '❌' when 'NOTE' then '⚠️' else '✅' end as flag,
  status,
  check_name,
  detail
from checks
order by case status when 'FAIL' then 0 when 'NOTE' then 1 else 2 end, ord;

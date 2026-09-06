-- Verification for the 2026-08-22 migrations.
--
--   supabase db reset                       # applies all migrations
--   psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" \
--        -f supabase/tests/feed_sql_checks.sql
--
-- Every check RAISEs EXCEPTION on failure, so a clean run means everything
-- passed. Run it against local Supabase before pushing to the hosted project.

\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------------
-- 1. Objects exist with the expected shape
-- ---------------------------------------------------------------------------
do $$
declare
  fn text;
begin
  -- public.homepage is intentionally gone (20260822190300). It relied on
  -- `WITH (security_invoker = on)`, which `supabase db diff` cannot represent,
  -- so every generated migration silently recreated it without that option and
  -- would have leaked embargoed articles. If it comes back, something applied a
  -- generated diff.
  if exists (select 1 from pg_views where schemaname = 'public' and viewname = 'homepage') then
    raise exception
      'FAIL: public.homepage exists again -- it was dropped deliberately. Did a generated db diff get applied?';
  end if;

  foreach fn in array array['list_homepage_posts', 'nearest_issue_date', 'list_unique_tags']
  loop
    if not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = fn
    ) then
      raise exception 'FAIL: public.% is missing', fn;
    end if;

    -- SECURITY INVOKER is what makes RLS on public.pages evaluate as the
    -- caller. SECURITY DEFINER here would bypass it and publish unpublished
    -- articles -- the same failure the view had, just spelled differently.
    if exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = fn and p.prosecdef
    ) then
      raise exception
        'FAIL: public.% is SECURITY DEFINER -- it must be SECURITY INVOKER or RLS is bypassed', fn;
    end if;
  end loop;

  raise notice 'OK  1. feed functions exist, are SECURITY INVOKER, and no homepage view';
end $$;


-- ---------------------------------------------------------------------------
-- 1b. The cover -> image_metadata join must not be tied to one project host
--
--     It used to match a hardcoded https://<project>.supabase.co prefix, which
--     would silently stop matching on a preview branch or new project and send
--     cover dimensions back to NULL.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'list_homepage_posts'
      and p.prosrc like '%supabase.co%'
  ) then
    raise exception
      'FAIL: list_homepage_posts hardcodes a Supabase project host -- cover dimensions will break on any other project';
  end if;

  raise notice 'OK  1b. cover join is host-agnostic';
end $$;


-- ---------------------------------------------------------------------------
-- 2. THE ORIGINAL BUG: anon can read image_metadata
--
--    This is what was broken. RLS was enabled with only a service-role policy,
--    so as anon the homepage LEFT JOIN matched nothing and cover_width came
--    back NULL with no error.
-- ---------------------------------------------------------------------------
do $$
declare
  policy_count integer;
begin
  select count(*) into policy_count
  from pg_policies
  where schemaname = 'public' and tablename = 'image_metadata'
    and cmd in ('SELECT', 'ALL')
    and 'anon' = any(roles);

  if policy_count = 0 then
    raise exception 'FAIL: no SELECT policy on image_metadata grants anon -- cover dimensions will be NULL';
  end if;

  raise notice 'OK  2. anon has a permissive SELECT policy on image_metadata';
end $$;


-- ---------------------------------------------------------------------------
-- 3. Grants that were only working via ALTER DEFAULT PRIVILEGES
-- ---------------------------------------------------------------------------
do $$
begin
  -- (public.homepage no longer exists; the feed is reached only via the
  -- functions checked below.)
  if not has_function_privilege('anon', 'public.list_unique_tags(text)', 'EXECUTE') then
    raise exception 'FAIL: anon lacks EXECUTE on list_unique_tags';
  end if;
  if not has_function_privilege('anon', 'public.list_homepage_posts(text,text,date,integer,integer)', 'EXECUTE') then
    raise exception 'FAIL: anon lacks EXECUTE on list_homepage_posts';
  end if;
  if not has_function_privilege('anon', 'public.nearest_issue_date(date)', 'EXECUTE') then
    raise exception 'FAIL: anon lacks EXECUTE on nearest_issue_date';
  end if;

  -- list_storage_objects_recursive must stay service-role only.
  if has_function_privilege('anon', 'public.list_storage_objects_recursive(text,text,integer,text)', 'EXECUTE') then
    raise exception 'FAIL: anon can execute list_storage_objects_recursive -- exposes the whole media bucket listing';
  end if;

  -- public.pages: anon reads, never writes. TRUNCATE especially -- it is NOT
  -- subject to RLS, so the usual "policies protect us" reasoning does not cover
  -- it. anon held it by default until 20260822190200.
  if not has_table_privilege('anon', 'public.pages', 'SELECT') then
    raise exception 'FAIL: anon lacks SELECT on public.pages -- article pages would break';
  end if;
  if has_table_privilege('anon', 'public.pages', 'TRUNCATE') then
    raise exception 'FAIL: anon has TRUNCATE on public.pages -- TRUNCATE bypasses RLS entirely';
  end if;
  if has_table_privilege('anon', 'public.pages', 'INSERT')
     or has_table_privilege('anon', 'public.pages', 'UPDATE')
     or has_table_privilege('anon', 'public.pages', 'DELETE') then
    raise exception 'FAIL: anon has write grants on public.pages';
  end if;
  if has_table_privilege('anon', 'public.image_metadata', 'INSERT')
     or has_table_privilege('anon', 'public.image_metadata', 'UPDATE')
     or has_table_privilege('anon', 'public.image_metadata', 'DELETE') then
    raise exception 'FAIL: anon has write grants on public.image_metadata';
  end if;

  -- service_role must retain DELETE: the `wipe` sync option calls
  -- pageCrud.deleteForSource(), a scoped DELETE.
  if not has_table_privilege('service_role', 'public.pages', 'DELETE') then
    raise exception 'FAIL: service_role lacks DELETE on public.pages -- sync wipe would break';
  end if;
  if not has_table_privilege('service_role', 'public.pages', 'INSERT') then
    raise exception 'FAIL: service_role lacks INSERT on public.pages -- sync would break';
  end if;

  raise notice 'OK  3. grants are explicit and correctly scoped';
end $$;


-- ---------------------------------------------------------------------------
-- 3b. Default privileges are off for future objects
--
--     This is what makes privileges declarative here: with no automatic grants,
--     every privilege is an explicit GRANT, which the diff engine can express.
--     If these defaults come back, the next regenerated baseline will silently
--     ship a table that anon can TRUNCATE.
--
--     Also the local mirror of Supabase's 2026-10-30 breaking change, so this
--     doubles as a check that we stay aligned with it.
-- ---------------------------------------------------------------------------
--     TABLES: tested empirically by creating one, rather than by reading
--     pg_default_acl -- which would mean guessing the role the defaults are
--     registered against (`supabase_admin` locally, `postgres` hosted) and
--     parsing an ACL string.
do $$
declare
  exposed boolean;
begin
  create table public.zz_default_probe (id integer);

  select has_table_privilege('anon', 'public.zz_default_probe', 'SELECT')
      or has_table_privilege('anon', 'public.zz_default_probe', 'INSERT')
      or has_table_privilege('anon', 'public.zz_default_probe', 'TRUNCATE')
      or has_table_privilege('authenticated', 'public.zz_default_probe', 'SELECT')
    into exposed;

  drop table public.zz_default_probe;

  if exposed then
    raise exception
      'FAIL 3b: a newly created table in `public` is reachable by anon/authenticated without an explicit grant. See migrations/*_default_privileges.sql -- note the defaults may be registered against supabase_admin rather than postgres.';
  end if;

  raise notice 'OK  3b. new tables are NOT auto-exposed';
end $$;


-- ---------------------------------------------------------------------------
-- 3c. RPC exposure allowlist
--
--     Every function in `public` is a PostgREST RPC endpoint if anon can execute
--     it. This asserts the exposed set is exactly the intended one, which is the
--     property that actually matters -- and unlike probing default privileges it
--     holds regardless of *how* a function came to be exposed (Postgres's PUBLIC
--     default, an explicit grant, a role we forgot to cover, a future migration).
--
--     Add a function here only when you mean to expose it as a public endpoint.
-- ---------------------------------------------------------------------------
do $$
declare
  allowed text[] := array[
    'list_homepage_posts',
    'nearest_issue_date',
    'list_unique_tags'
  ];
  leaked text;
begin
  select string_agg(format('%s(%s)', p.proname, pg_get_function_arguments(p.oid)), ', ')
    into leaked
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prokind = 'f'
    and not (p.proname = any(allowed))
    and has_function_privilege('anon', p.oid, 'EXECUTE');

  if leaked is not null then
    raise exception
      E'FAIL 3c: anon can execute unintended function(s) in `public`: %\n'
      '  Each is a live PostgREST RPC endpoint. Either add an explicit\n'
      '  `revoke all on function ... from public, anon, authenticated;` to\n'
      '  migrations/*_harden_privileges.sql, or add it to the allowlist in this\n'
      '  check if exposing it is intentional.', leaked;
  end if;

  -- And the converse: the intended endpoints must actually work.
  foreach leaked in array allowed
  loop
    if not exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = leaked
        and has_function_privilege('anon', p.oid, 'EXECUTE')
    ) then
      raise exception
        'FAIL 3c: anon CANNOT execute public.% -- PostgREST will return 42501 and the feed will be empty. Add a grant in migrations/*_harden_privileges.sql.', leaked;
    end if;
  end loop;

  raise notice 'OK  3c. exactly the intended functions are anon-executable';
end $$;


-- ---------------------------------------------------------------------------
-- 3d. Every function pins search_path
--
--     Supabase's database linter calls this `function_search_path_mutable`.
--     Without an explicit search_path a function resolves unqualified names
--     using the CALLER's path, so a caller who can create objects in an earlier
--     schema can shadow what the function meant to call. Severe for SECURITY
--     DEFINER; still worth closing for INVOKER functions.
--
--     Also guards a subtler trap: CREATE OR REPLACE FUNCTION resets both the
--     ACL *and* any SET clauses. Redefining a function without restating
--     `set search_path` silently reintroduces this.
-- ---------------------------------------------------------------------------
do $$
declare
  mutable text;
begin
  select string_agg(format('%s(%s)', p.proname, pg_get_function_arguments(p.oid)), ', ')
    into mutable
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prokind in ('f', 'p')
    and not exists (
      select 1 from unnest(coalesce(p.proconfig, '{}')) as cfg
      where cfg like 'search\_path=%'
    );

  if mutable is not null then
    raise exception
      E'FAIL 3d: function(s) in `public` have a mutable search_path: %\n'
      '  Add `set search_path = ''''` (and schema-qualify everything) or\n'
      '  `set search_path to ''public'', ''pg_temp''` to each.', mutable;
  end if;

  raise notice 'OK  3d. every function pins search_path';
end $$;


-- ---------------------------------------------------------------------------
-- 4. Issue-boundary behavior, on synthetic data
--
--    Three issues: 5 posts, 5 posts, 3 posts. A target of 3 must still return
--    all 5 of the first issue (never end mid-issue), and a target of 6 must
--    return 10 (the straddling issue comes back whole).
--
--    NOTE: this runs as the connecting superuser, so RLS on public.pages is
--    bypassed and any real synced content lands in the same result set. Rather
--    than deleting rows (destructive if this transaction ever committed), the
--    counts below are asserted as deltas against baselines measured first.
--    Seeded issues use year-2099 dates so they always occupy issue ranks 1-3.
-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
  ranks integer[];
  d date;
  base_before_0303 integer;
  base_alpha integer;
  t_issues integer;
begin
  -- Baselines, measured before seeding. Read the base table directly, with the
  -- same datasource filter the feed functions apply.
  select count(*) into base_before_0303
  from public.pages
  where datasource_alias = 'tech-article-staging'
    and (publish_at at time zone 'America/Los_Angeles')::date <= '2099-03-03'::date;

  select count(*) into base_alpha
  from public.pages
  where datasource_alias = 'tech-article-staging'
    and tags ? 'alpha';

  insert into public.pages (page_id, title, slug, publish_at, updated_at,
                            datasource_id, datasource_alias, tags, meta, content, summary)
  select
    'zz-test-' || i,
    'Test post ' || i,
    'zz-test-' || i,
    (case when i <= 5 then '2099-03-10' when i <= 10 then '2099-03-03' else '2099-02-24' end)::date
      + time '12:00',
    now(),
    'test-ds', 'tech-article-staging',
    case when i % 2 = 0 then '["alpha"]'::jsonb else '["beta"]'::jsonb end,
    '{}'::jsonb,
    'body text ' || i,
    'summary ' || i
  from generate_series(1, 13) i;

  -- target 3 -> first issue whole (5 rows)
  select count(*) into n from public.list_homepage_posts(null, null, '2099-12-31', 0, 3);
  if n <> 5 then
    raise exception 'FAIL 4a: target 3 returned % rows, expected 5 (whole first issue)', n;
  end if;

  -- target 6 -> two issues whole (10 rows)
  select count(*) into n from public.list_homepage_posts(null, null, '2099-12-31', 0, 6);
  if n <> 10 then
    raise exception 'FAIL 4b: target 6 returned % rows, expected 10 (two whole issues)', n;
  end if;

  -- paging: skip 1 issue, target 3 -> second issue whole (5 rows), rank 2
  select count(*), array_agg(distinct issue_rank)
    into n, ranks
  from public.list_homepage_posts(null, null, '2099-12-31', 1, 3);
  if n <> 5 then
    raise exception 'FAIL 4c: issue_offset 1 returned % rows, expected 5', n;
  end if;
  if ranks <> array[2] then
    raise exception 'FAIL 4d: issue_offset 1 gave ranks %, expected {2}', ranks;
  end if;

  -- past the end -> empty, not an error. Offset is derived from the reported
  -- issue count so this holds regardless of how much real content exists.
  select coalesce(max(total_issues), 0) into t_issues
  from public.list_homepage_posts(null, null, '2099-12-31', 0, 1);

  select count(*) into n
  from public.list_homepage_posts(null, null, '2099-12-31', t_issues, 30);
  if n <> 0 then
    raise exception 'FAIL 4e: issue_offset %(= all issues) returned % rows, expected 0', t_issues, n;
  end if;

  -- before_date excludes newer issues: the two older seeded issues (5 + 3),
  -- plus whatever real content predates 2099-03-03 (i.e. all of it).
  select count(*) into n from public.list_homepage_posts(null, null, '2099-03-03', 0, 1000000);
  if n <> base_before_0303 + 8 then
    raise exception 'FAIL 4f: before_date 2099-03-03 returned % rows, expected % (baseline % + 8 seeded)',
      n, base_before_0303 + 8, base_before_0303;
  end if;

  -- tag filter uses the jsonb ? operator; 6 of 13 seeded posts are "alpha"
  select count(*) into n from public.list_homepage_posts(null, 'alpha', '2099-12-31', 0, 1000000);
  if n <> base_alpha + 6 then
    raise exception 'FAIL 4g: tag alpha returned % rows, expected % (baseline % + 6 seeded)',
      n, base_alpha + 6, base_alpha;
  end if;

  -- full-text search reaches title
  select count(*) into n from public.list_homepage_posts('"Test post 7"', null, '2099-12-31', 0, 100);
  if n < 1 then
    raise exception 'FAIL 4h: websearch for a known title returned no rows';
  end if;

  -- content_preview must be populated (backs the summary_html fallback).
  -- Scoped to seeded rows: real articles may legitimately have empty content.
  if exists (
    select 1 from public.list_homepage_posts(null, null, '2099-12-31', 0, 100)
    where page_id like 'zz-test-%'
      and (content_preview is null or content_preview = '')
  ) then
    raise exception 'FAIL 4i: content_preview is empty for seeded rows';
  end if;

  -- nearest_issue_date snaps in either direction, ties toward the newer issue
  select public.nearest_issue_date('2099-03-09') into d;
  if d <> '2099-03-10'::date then
    raise exception 'FAIL 4j: nearest to 2099-03-09 was %, expected 2099-03-10', d;
  end if;

  select public.nearest_issue_date('2099-03-04') into d;
  if d <> '2099-03-03'::date then
    raise exception 'FAIL 4k: nearest to 2099-03-04 was %, expected 2099-03-03', d;
  end if;

  raise notice 'OK  4. issue-boundary paging, before_date, tag, fts, nearest_issue_date';
end $$;


-- ---------------------------------------------------------------------------
-- 5. RLS still hides unpublished content from anon through the feed function
--
--    This is the check that matters most. The function is SECURITY INVOKER, so
--    the "Public pages read access" policy on public.pages must filter these out
--    even though the function itself applies no publish filter.
-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
begin
  insert into public.pages (page_id, title, slug, publish_at, updated_at,
                            datasource_id, datasource_alias, tags, meta, content)
  values
    ('zz-test-future', 'Embargoed', 'zz-test-future',
     now() + interval '30 days', now(), 'test-ds', 'tech-article-staging', '[]'::jsonb, '{}'::jsonb, 'x'),
    ('zz-test-null', 'Unpublished', 'zz-test-null',
     null, now(), 'test-ds', 'tech-article-staging', '[]'::jsonb, '{}'::jsonb, 'x');

  set local role anon;

  -- Wide net: no before_date, huge target, so nothing is excluded by the
  -- function's own filters. Anything returned got past RLS.
  select count(*) into n
  from public.list_homepage_posts(null, null, null, 0, 1000000)
  where page_id in ('zz-test-future', 'zz-test-null');

  reset role;

  if n <> 0 then
    raise exception
      'FAIL 5: anon saw % embargoed/unpublished rows through list_homepage_posts -- RLS is not being enforced', n;
  end if;

  raise notice 'OK  5. anon cannot see unpublished or future-dated pages';
end $$;


-- ---------------------------------------------------------------------------
-- 6. anon actually receives cover dimensions (end-to-end, as anon)
-- ---------------------------------------------------------------------------
do $$
declare
  w integer;
begin
  -- publish_at must be in the PAST here. This check reads as anon, and the
  -- "Public pages read access" policy requires publish_at <= now(), so a future
  -- date would hide the row and make this look like the cover_width bug.
  insert into public.pages (page_id, title, slug, publish_at, updated_at,
                            datasource_id, datasource_alias, tags, meta, content, cover)
  -- Deliberately a DIFFERENT host from the production project. The join must
  -- match on the path segment alone; if someone reintroduces a hardcoded host,
  -- this check fails.
  values ('zz-test-cover', 'Has cover', 'zz-test-cover', now() - interval '7 days', now(),
          'test-ds', 'tech-article-staging', '[]'::jsonb, '{}'::jsonb, 'x',
          'https://some-other-project.supabase.co/storage/v1/object/public/media/zztest.jpg');

  -- image_metadata FKs bucket_id -> storage.buckets, so the bucket must exist.
  insert into storage.buckets (id, name, public)
  values ('media', 'media', true)
  on conflict (id) do nothing;

  insert into public.image_metadata (bucket_id, object_path, width, height)
  values ('media', 'zztest.jpg', 1600, 900)
  on conflict (bucket_id, object_path) do update
    set width = excluded.width, height = excluded.height;

  set local role anon;
  select cover_width into w
  from public.list_homepage_posts(null, null, null, 0, 1000000)
  where page_id = 'zz-test-cover';
  reset role;

  if w is distinct from 1600 then
    raise exception
      'FAIL 6: anon got cover_width=% for a page with metadata, expected 1600. THIS IS THE ORIGINAL BUG (or the cover join is host-specific again).', w;
  end if;

  raise notice 'OK  6. anon receives cover_width/cover_height (original bug is fixed)';
end $$;


rollback;  -- nothing is persisted; all seed rows disappear

\echo ''
\echo 'All feed SQL checks passed.'

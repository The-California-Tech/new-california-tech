-- Bring the hosted project up to the state the squashed baseline describes.
--
-- WHY THIS EXISTS
--   The migration history was squashed on 2026-09-06: 13 accreted migrations
--   became one generated baseline. The hosted project had all 13 applied, so its
--   schema matches the *pre-September* state -- it has never seen any of the
--   September work. Re-running the baseline there is not an option (it does
--   `create table public.pages`, which already exists), and marking the baseline
--   "applied" without running it would leave production missing the feed
--   functions entirely, 500-ing the homepage.
--
--   So: history gets repaired to match local, and this migration carries the
--   actual schema delta. Confirmed against `supabase db diff --linked` on
--   2026-09-06; prod was missing exactly the objects below.
--
--   EVERY STATEMENT IS IDEMPOTENT. Locally these are all no-ops (the baseline
--   already did them); on the hosted project they are the real change. That
--   matters because after the history repair this file runs in both places.
--
-- ORDER OF OPERATIONS FOR THE HOSTED PROJECT
--   1. supabase db dump --linked            (done -- keep the backup)
--   2. supabase migration repair --status reverted <the 13 old versions>
--   3. supabase migration repair --status applied 20260906184900 20260906184907 20260906185000
--   4. supabase db push                     (applies only this file)
--   5. psql "$PROD_URL" -f supabase/tests/feed_sql_checks.sql

-- ---------------------------------------------------------------------------
-- 1. Default privileges off for future objects.
--
-- Invisible to `db diff` (its privilege model is additive, so it can express
-- GRANT but never "PUBLIC must not hold the default"). Discovering the role
-- rather than assuming `postgres`: locally these are registered against
-- `supabase_admin`. On the hosted project `postgres` is not a superuser and may
-- not be permitted to alter another role's defaults -- hence the exception
-- handler. A warning there is acceptable; section 4 still strips the grants that
-- already exist, and feed_sql_checks 3b will fail loudly if new objects end up
-- exposed.
-- ---------------------------------------------------------------------------
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
      execute format('alter default privileges for role %I in schema public revoke all on tables from anon, authenticated, service_role', r.rolename);
      execute format('alter default privileges for role %I in schema public revoke all on sequences from anon, authenticated, service_role', r.rolename);
      execute format('alter default privileges for role %I in schema public revoke all on functions from public', r.rolename);
      execute format('alter default privileges for role %I in schema public revoke all on functions from anon, authenticated, service_role', r.rolename);
      raise notice 'default privileges revoked for role %', r.rolename;
    exception when insufficient_privilege then
      raise warning 'could not alter default privileges for role % -- verify with feed_sql_checks 3b', r.rolename;
    end;
  end loop;
end $$;

alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on functions from public;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. THE LIVE BUG: anon cannot read image_metadata on the hosted project.
--
-- public.homepage / list_homepage_posts LEFT JOIN this table while running as
-- the caller. RLS is enabled with only a service-role policy, so as `anon` the
-- join matches zero rows and cover_width/cover_height come back NULL -- silently,
-- because a LEFT JOIN finding nothing is not an error. This is the bug the whole
-- September effort started from, and it is still live in production.
-- ---------------------------------------------------------------------------
drop policy if exists "Public image metadata read" on public.image_metadata;
create policy "Public image metadata read"
  on public.image_metadata
  as permissive
  for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- 3. Feed functions. Prod has never had these; the new app code calls them, so
--    without this the homepage and /issues/[date] fail outright.
--
--    SECURITY INVOKER is stated explicitly: these read public.pages as the
--    caller so the "Public pages read access" policy filters unpublished and
--    embargoed articles. Never make them SECURITY DEFINER.
-- ---------------------------------------------------------------------------
create or replace function public.list_homepage_posts(
  p_query        text    default null,
  p_tag          text    default null,
  p_before_date  date    default null,
  p_issue_offset integer default 0,
  p_target_count integer default 30
)
returns table (
  page_id          text,
  title            text,
  slug             text,
  authors          jsonb,
  tags             jsonb,
  publish_at       timestamp with time zone,
  updated_at       timestamp with time zone,
  last_synced_at   timestamp with time zone,
  meta             jsonb,
  summary          text,
  content_preview  text,
  cover            text,
  cover_width      integer,
  cover_height     integer,
  datasource_id    text,
  datasource_alias text,
  issue_date       date,
  issue_rank       integer,
  total_issues     integer,
  total_posts      integer
)
language sql
stable
security invoker
set search_path to 'public', 'pg_temp'
as $function$
  with filtered as (
    select
      p."page_id",
      p."title",
      p."slug",
      p."authors",
      p."tags",
      p."publish_at",
      p."updated_at",
      p."last_synced_at",
      p."meta",
      p."summary",
      -- `content` itself is excluded: too large for a feed payload. This prefix
      -- backs post-converter.ts's summary_html fallback.
      left(p."content", 500) as content_preview,
      p."cover",
      im."width"  as cover_width,
      im."height" as cover_height,
      p."datasource_id",
      p."datasource_alias",
      (p."publish_at" at time zone 'America/Los_Angeles')::date as v_issue_date
    from public.pages p
    left join public.image_metadata im
      on im."bucket_id" = 'media'
     and im."object_path" = nullif(
           split_part(split_part(p."cover", '/storage/v1/object/public/media/', 2), '?', 1),
           ''
         )
    where
      p."datasource_alias" = 'tech-article-staging'
      and (p_query is null or p_query = ''
        or p."search_fts" @@ websearch_to_tsquery('english', p_query))
      and (p_tag is null or p_tag = ''
        or p."tags" ? p_tag)
      and (p_before_date is null
        or (p."publish_at" at time zone 'America/Los_Angeles')::date <= p_before_date)
  ),
  issues as (
    select
      f.v_issue_date,
      count(*) as post_count,
      row_number() over (order by f.v_issue_date desc nulls last) as rnk
    from filtered f
    group by f.v_issue_date
  ),
  -- WHERE is applied before window functions, so the running total below
  -- starts fresh at the first issue after the offset.
  paged as (
    select
      i.*,
      sum(i.post_count) over (
        order by i.rnk
        rows between unbounded preceding and current row
      ) as cume
    from issues i
    where i.rnk > greatest(coalesce(p_issue_offset, 0), 0)
  ),
  -- Keep an issue if the rows *before* it had not yet met the target. The
  -- first issue always qualifies (0 preceding rows), so a page is never empty
  -- while issues remain, and the straddling issue is returned whole.
  selected as (
    select pg.v_issue_date, pg.rnk
    from paged pg
    where pg.cume - pg.post_count < greatest(coalesce(p_target_count, 30), 1)
  ),
  totals as (
    select
      (select count(*) from issues)   as t_issues,
      (select count(*) from filtered) as t_posts
  )
  select
    f."page_id",
    f."title",
    f."slug",
    f."authors",
    f."tags",
    f."publish_at",
    f."updated_at",
    f."last_synced_at",
    f."meta",
    f."summary",
    f.content_preview,
    f."cover",
    f.cover_width,
    f.cover_height,
    f."datasource_id",
    f."datasource_alias",
    f.v_issue_date      as issue_date,
    s.rnk::integer      as issue_rank,
    t.t_issues::integer as total_issues,
    t.t_posts::integer  as total_posts
  from filtered f
  join selected s on s.v_issue_date is not distinct from f.v_issue_date
  cross join totals t
  order by
    f."publish_at" desc nulls last,
    case
      when jsonb_typeof(f."meta"->'layoutWeight') = 'number'
        then (f."meta"->>'layoutWeight')::numeric
      else null
    end desc nulls last;
$function$;

create or replace function public.nearest_issue_date(p_target date)
returns date
language sql
stable
security invoker
set search_path to 'public', 'pg_temp'
as $function$
  select d.issue_date
  from (
    select distinct (p."publish_at" at time zone 'America/Los_Angeles')::date as issue_date
    from public.pages p
    where p."datasource_alias" = 'tech-article-staging'
      and p."publish_at" is not null
  ) d
  order by abs(d.issue_date - p_target) asc, d.issue_date desc
  limit 1;
$function$;

create or replace function "public"."list_unique_tags"("p_datasource_alias" text)
returns table ("tag" text)
language sql
stable
security invoker
set search_path to 'public', 'pg_temp'
as $function$
  select distinct
    "t"."tag"
  from
    "public"."pages" as "p"
    cross join lateral jsonb_array_elements_text(
      case
        when jsonb_typeof("p"."tags") = 'array' then "p"."tags"
        else '[]'::jsonb
      end
    ) as "t"("tag")
  where
    "p"."datasource_alias" = "p_datasource_alias"
  order by
    "t"."tag";
$function$;

grant execute on function public.list_homepage_posts(text, text, date, integer, integer) to anon, authenticated, service_role;
grant execute on function public.nearest_issue_date(date) to anon, authenticated, service_role;
grant execute on function public.list_unique_tags(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Strip the grants prod still carries.
--
-- TRUNCATE is the one that matters: it is NOT subject to RLS, so "policies
-- protect us" does not cover it, and `anon` currently holds it on both tables in
-- production.
--
-- service_role keeps DELETE -- the `wipe` sync option calls
-- pageCrud.deleteForSource(), a scoped DELETE.
-- ---------------------------------------------------------------------------
revoke insert, update, delete, truncate, references, trigger on table public.pages from anon;
revoke insert, update, delete, truncate, references, trigger on table public.pages from authenticated;
revoke truncate, references, trigger on table public.pages from service_role;

revoke insert, update, delete, truncate, references, trigger on table public.image_metadata from anon;
revoke insert, update, delete, truncate, references, trigger on table public.image_metadata from authenticated;
revoke truncate, references, trigger on table public.image_metadata from service_role;

grant select on table public.pages to anon;
grant select on table public.pages to authenticated;
grant select, insert, update, delete on table public.pages to service_role;

grant select on table public.image_metadata to anon;
grant select on table public.image_metadata to authenticated;
grant select, insert, update, delete on table public.image_metadata to service_role;

revoke all on function public.list_storage_objects_recursive(text, text, integer, text) from public;
revoke all on function public.list_storage_objects_recursive(text, text, integer, text) from anon;
revoke all on function public.list_storage_objects_recursive(text, text, integer, text) from authenticated;
grant execute on function public.list_storage_objects_recursive(text, text, integer, text) to service_role;

revoke all on function public.set_updated_at() from public;
revoke all on function public.set_updated_at() from anon;
revoke all on function public.set_updated_at() from authenticated;

-- ---------------------------------------------------------------------------
-- 5. Drop the superseded view. LAST, so the functions above exist first.
--
-- public.homepage relied on `WITH (security_invoker = on)`, which `db diff`
-- cannot represent -- every generated migration silently recreated it without
-- that option, which would have leaked unpublished articles. Its query now lives
-- inside the functions instead. Nothing queries the view.
-- ---------------------------------------------------------------------------
drop view if exists public.homepage;

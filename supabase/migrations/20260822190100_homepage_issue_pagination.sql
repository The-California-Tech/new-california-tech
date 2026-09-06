-- Issue-boundary-aware feed pagination, moved from JS into Postgres.
--
-- Replaces the getIssueBoundedEndIndex() logic that used to run in
-- src/routes/+page.server.ts after fetching up to 1000 rows. The rule is
-- unchanged: a feed page never ends mid-issue. Given a target row count, we
-- return every article belonging to the issues needed to reach that count,
-- including the whole of the issue that straddles the boundary.
--
-- Pagination is by *issue*, not by row: callers pass p_issue_offset (how many
-- whole issues to skip) rather than a row offset. This is what makes the
-- boundary rule stable across pages -- a row offset would drift as soon as one
-- issue got extended.

-- 1) Add content_preview to the homepage view.
--
--    The view intentionally omits `content` (it is large and the feed does not
--    render it), but post-converter.ts falls back to content when a post has no
--    summary, to synthesize summary_html. Without this column that fallback
--    silently produced empty preview text for every summary-less article.
--    A prefix is enough for a ~200-char preview.
--
--    CREATE OR REPLACE VIEW can only append columns, so content_preview goes
--    last. Everything above it is byte-identical to 20260619020739.
create or replace view "public"."homepage" with (security_invoker = on) as
select
  p."cover",
  p."last_synced_at",
  p."summary",
  p."page_id",
  p."title",
  p."slug",
  p."publish_at",
  p."updated_at",
  p."datasource_id",
  p."datasource_alias",
  p."authors",
  p."tags",
  p."meta",
  p."search_fts",
  im."width" as "cover_width",
  im."height" as "cover_height",
  left(p."content", 500) as "content_preview"
from "public"."pages" p
left join "public"."image_metadata" im
  on im."bucket_id" = 'media'
 and im."object_path" = case
   when p."cover" like 'https://xguzskbxiptvhbyggkpl.supabase.co/storage/v1/object/public/media/%'
     then nullif(split_part(split_part(p."cover", '/storage/v1/object/public/media/', 2), '?', 1), '')
   else null
 end
 where p.datasource_alias = 'tech-article-staging'
order by
  p."publish_at" desc nulls last,
  case
    when jsonb_typeof(p."meta"->'layoutWeight') = 'number'
      then (p."meta"->>'layoutWeight')::numeric
    else null
  end desc nulls last;

grant select on table public.homepage to anon;
grant select on table public.homepage to authenticated;
grant select on table public.homepage to service_role;


-- 2) The feed function.
--
--    p_query        full-text search, matched against pages.search_fts using
--                   websearch_to_tsquery (same dialect the client used with
--                   supabase-js `textSearch(..., { type: 'websearch' })`)
--    p_tag          single tag; uses the jsonb `?` operator so the existing
--                   GIN index on pages.tags applies
--    p_before_date  only issues on or before this Pacific date. Drives
--                   /issues/[date], which is "the feed, starting at issue X"
--    p_issue_offset skip this many whole issues (pagination cursor)
--    p_target_count soft row target; the last issue is always returned whole,
--                   so the actual row count is >= this unless we ran out
--
--    Returns feed rows plus issue_rank (the cursor to pass back as
--    p_issue_offset), and total_issues / total_posts for hasMore + counts.
set check_function_bodies = off;

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
      h.*,
      (h."publish_at" at time zone 'America/Los_Angeles')::date as v_issue_date
    from public.homepage h
    where
      (p_query is null or p_query = ''
        or h."search_fts" @@ websearch_to_tsquery('english', p_query))
      and (p_tag is null or p_tag = ''
        or h."tags" ? p_tag)
      and (p_before_date is null
        or (h."publish_at" at time zone 'America/Los_Angeles')::date <= p_before_date)
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
    f."content_preview",
    f."cover",
    f."cover_width",
    f."cover_height",
    f."datasource_id",
    f."datasource_alias",
    f.v_issue_date          as issue_date,
    s.rnk::integer          as issue_rank,
    t.t_issues::integer     as total_issues,
    t.t_posts::integer      as total_posts
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

grant execute on function public.list_homepage_posts(text, text, date, integer, integer) to anon;
grant execute on function public.list_homepage_posts(text, text, date, integer, integer) to authenticated;
grant execute on function public.list_homepage_posts(text, text, date, integer, integer) to service_role;


-- 3) Nearest issue date, for /issues/[date].
--
--    Replaces findNearestIssueDate() in post-pagination.ts, which needed the
--    full list of distinct issue dates in memory (hence the 1000-row fetch on
--    that route). Semantics preserved exactly: smallest absolute distance in
--    either direction, ties broken toward the more recent issue.
create or replace function public.nearest_issue_date(p_target date)
returns date
language sql
stable
security invoker
set search_path to 'public', 'pg_temp'
as $function$
  select d.issue_date
  from (
    select distinct (h."publish_at" at time zone 'America/Los_Angeles')::date as issue_date
    from public.homepage h
    where h."publish_at" is not null
  ) d
  order by abs(d.issue_date - p_target) asc, d.issue_date desc
  limit 1;
$function$;

grant execute on function public.nearest_issue_date(date) to anon;
grant execute on function public.nearest_issue_date(date) to authenticated;
grant execute on function public.nearest_issue_date(date) to service_role;

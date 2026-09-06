-- ===========================================================================
-- CALIFORNIA TECH -- APP-OWNED SCHEMA
--
-- Everything here is the Tech's, built *on top of* symbiont's public.pages.
-- symbiont-cms has no knowledge of any of it: the concepts below -- issues,
-- issue dates, issue-boundary pagination, the `tech-article-staging` datasource
-- -- are editorial, not CMS. See 10_symbiont_core.sql for the other side.
--
-- Two shapes of app-owned object live here:
--
--   1. EXTENSIONS to symbiont's table. `search_fts` is a column the Tech adds
--      to public.pages via ALTER TABLE. symbiont does not know it exists and
--      does not need to. This is the "extend, don't fork" pattern -- when
--      symbiont eventually owns its own schema, this ALTER still applies.
--
--   2. DERIVED read paths. Functions the site queries instead of hitting
--      public.pages directly.
--
-- NO VIEWS HERE, DELIBERATELY. public.homepage used to do this job and was
-- dropped in 20260822190300. It relied on `WITH (security_invoker = on)` to
-- make RLS evaluate as the caller, and `supabase db diff` cannot represent view
-- reloptions -- every generated migration silently recreated the view without
-- it, which would have leaked unpublished and embargoed articles into the public
-- feed with no error. Functions spell `security invoker` as a literal word in
-- their body, which the diff tool round-trips exactly, so the protection is
-- visible in code review instead of hiding in metadata a routine command erases.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. Full-text search column on symbiont's table
--
-- Weights: title A, summary + authors B, content C.
-- ---------------------------------------------------------------------------
ALTER TABLE "public"."pages"
DROP COLUMN IF EXISTS "search_fts";

ALTER TABLE "public"."pages"
ADD COLUMN "search_fts" tsvector
GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
  setweight(to_tsvector('english', coalesce("summary", '')), 'B') ||
  setweight(
    jsonb_to_tsvector('english', coalesce("authors", '[]'::jsonb), '["string"]'),
    'B'
  ) ||
  setweight(to_tsvector('english', coalesce("content", '')), 'C')
) STORED;

CREATE INDEX IF NOT EXISTS "pages_search_fts_idx"
ON "public"."pages"
USING gin ("search_fts");


-- ---------------------------------------------------------------------------
-- 2. list_unique_tags -- distinct tags for one datasource
-- ---------------------------------------------------------------------------
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

grant execute on function public.list_unique_tags(text) to anon;
grant execute on function public.list_unique_tags(text) to authenticated;
grant execute on function public.list_unique_tags(text) to service_role;


-- ---------------------------------------------------------------------------
-- 3. list_homepage_posts -- issue-boundary-aware feed pagination
--
-- A feed page never ends mid-issue. Given a target row count, return every
-- article in the issues needed to reach it, including all of the issue that
-- straddles the boundary. Pagination is by issue (p_issue_offset), not by row,
-- because a row offset drifts as soon as one issue gets extended.
--
-- SECURITY INVOKER (the default, stated explicitly): this reads public.pages as
-- the caller, so the "Public pages read access" policy filters out unpublished
-- and future-dated articles. Do not make this SECURITY DEFINER.
--
-- The cover -> image_metadata join is host-agnostic on purpose. It used to match
-- a hardcoded `https://<project>.supabase.co/...` prefix, which would silently
-- stop matching on a Supabase preview branch or a new project, sending
-- cover_width/cover_height back to NULL. Splitting on the path segment alone
-- avoids that; split_part returns '' when the delimiter is absent, and the
-- nullif turns that into a NULL that simply fails the join.
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

grant execute on function public.list_homepage_posts(text, text, date, integer, integer) to anon;
grant execute on function public.list_homepage_posts(text, text, date, integer, integer) to authenticated;
grant execute on function public.list_homepage_posts(text, text, date, integer, integer) to service_role;


-- ---------------------------------------------------------------------------
-- 4. nearest_issue_date -- snap an arbitrary date to a real issue
--
-- Smallest absolute distance in either direction, ties broken toward the more
-- recent issue. Backs /issues/[date], which redirects to the nearest real issue.
--
-- No image join needed here -- it only ever needed publish dates, which is part
-- of why dropping the shared view simplified things.
-- ---------------------------------------------------------------------------
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

grant execute on function public.nearest_issue_date(date) to anon;
grant execute on function public.nearest_issue_date(date) to authenticated;
grant execute on function public.nearest_issue_date(date) to service_role;

-- Drop public.homepage; move its query inside the two functions that used it.
--
-- WHY
--   The view carried `WITH (security_invoker = on)`. That option is the only
--   thing making RLS on public.pages evaluate as the *caller*, and therefore the
--   only thing keeping unpublished and future-scheduled articles out of the
--   public feed.
--
--   `supabase db diff` cannot represent view reloptions. Every generated
--   migration recreated public.homepage WITHOUT security_invoker -- silently,
--   with no error, and the site would simply begin serving embargoed articles.
--   Verified: a `db diff -f probe` run on 2026-08-22 emitted exactly that.
--
--   Functions do not have this problem. `security invoker` is a word in the
--   function body, and the diff tool round-trips bodies byte-for-byte (confirmed
--   by nearest_issue_date matching exactly across schema and migration). So the
--   guarantee moves from invisible metadata into reviewable source.
--
--   Nothing else queried the view: the app goes through these two functions, and
--   nearest_issue_date never needed the image join at all.
--
-- ALSO FIXED HERE
--   The cover -> image_metadata join matched a hardcoded
--   `https://xguzskbxiptvhbyggkpl.supabase.co/...` prefix. That is
--   environment-specific, not merely app-specific: on a Supabase preview branch
--   or a new project the host differs, the LIKE stops matching, and
--   cover_width/cover_height silently return to NULL -- the same silent-NULL
--   failure this whole line of work started with. Now matched on the
--   `/storage/v1/object/public/media/` path segment alone.

-- 1) Recreate both functions reading base tables directly.

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


-- 2) list_unique_tags: state `security invoker` explicitly. Same default as
--    before, no behavior change -- but now the RLS posture of every app-owned
--    function is stated rather than implied.
create or replace function public.list_unique_tags(p_datasource_alias text)
returns table (tag text)
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


-- 3) Now the view is unreferenced. Drop it.
drop view if exists public.homepage;

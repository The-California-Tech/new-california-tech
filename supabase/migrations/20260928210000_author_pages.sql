-- Author pages: /authors and /authors/[author].
--
-- Two read paths over public.pages, both SECURITY INVOKER so RLS keeps
-- unpublished and embargoed articles (and authors with nothing else) hidden.
-- Mirrors sections 5 and 6 of supabase/schemas/20_tech_feed.sql; that file is
-- the source, this is the hand-written migration for it.
--
-- Additive only: no existing object changes, so this is safe to apply ahead of
-- the deploy that starts calling it.

-- ---------------------------------------------------------------------------
-- 5. list_authors -- every credited writer, for /authors and slug resolution
--
-- Names are trimmed before grouping: `Authors` is a Notion multi_select and a
-- trailing space makes a distinct option. Anything subtler (capitalisation,
-- curly vs straight apostrophes) is merged in the app by authorSlug(), not
-- here -- the slug is the app's idea of identity, and keeping it in one place
-- (src/lib/utils/authors.ts) means SQL and TypeScript cannot disagree about it.
--
-- SECURITY INVOKER, like everything in this file: an author whose only pieces
-- are unpublished or embargoed does not appear, because RLS hides the rows.
-- ---------------------------------------------------------------------------
create or replace function public.list_authors()
returns table (
  name              text,
  article_count     integer,
  latest_publish_at timestamp with time zone
)
language sql
stable
security invoker
set search_path to 'public', 'pg_temp'
as $function$
  select
    btrim(a.name)           as name,
    count(*)::integer       as article_count,
    max(p."publish_at")     as latest_publish_at
  from public.pages p
  cross join lateral jsonb_array_elements_text(
    case when jsonb_typeof(p."authors") = 'array' then p."authors" else '[]'::jsonb end
  ) as a(name)
  where
    p."datasource_alias" = 'tech-article-staging'
    and btrim(a.name) <> ''
  group by btrim(a.name)
  order by btrim(a.name);
$function$;

grant execute on function public.list_authors() to anon;
grant execute on function public.list_authors() to authenticated;
grant execute on function public.list_authors() to service_role;


-- ---------------------------------------------------------------------------
-- 6. list_author_posts -- one author's articles, newest first
--
-- Takes an ARRAY of names because /authors/[author] resolves a slug to every
-- spelling that produces it, and those are one person's articles.
--
-- Row-offset pagination, unlike the homepage feed: this is a byline archive,
-- not an issue layout, so there is no issue boundary to respect.
-- `total_posts` rides on every row (a window count) so one call gives both the
-- page and the pager.
--
-- Same cover -> image_metadata join as list_homepage_posts, and for the same
-- reason host-agnostic; see the note on section 3.
-- ---------------------------------------------------------------------------
create or replace function public.list_author_posts(
  p_names  text[],
  p_limit  integer default 30,
  p_offset integer default 0
)
returns table (
  page_id          text,
  title            text,
  slug             text,
  authors          jsonb,
  tags             jsonb,
  publish_at       timestamp with time zone,
  updated_at       timestamp with time zone,
  meta             jsonb,
  summary          text,
  content_preview  text,
  cover            text,
  cover_width      integer,
  cover_height     integer,
  datasource_id    text,
  datasource_alias text,
  total_posts      integer
)
language sql
stable
security invoker
set search_path to 'public', 'pg_temp'
as $function$
  select
    p."page_id",
    p."title",
    p."slug",
    p."authors",
    p."tags",
    p."publish_at",
    p."updated_at",
    p."meta",
    p."summary",
    left(p."content", 500) as content_preview,
    p."cover",
    im."width"  as cover_width,
    im."height" as cover_height,
    p."datasource_id",
    p."datasource_alias",
    (count(*) over ())::integer as total_posts
  from public.pages p
  left join public.image_metadata im
    on im."bucket_id" = 'media'
   and im."object_path" = nullif(
         split_part(split_part(p."cover", '/storage/v1/object/public/media/', 2), '?', 1),
         ''
       )
  where
    p."datasource_alias" = 'tech-article-staging'
    and exists (
      select 1
      from jsonb_array_elements_text(
        case when jsonb_typeof(p."authors") = 'array' then p."authors" else '[]'::jsonb end
      ) as a(name)
      where btrim(a.name) = any(p_names)
    )
  order by p."publish_at" desc nulls last, p."page_id"
  limit greatest(least(coalesce(p_limit, 30), 100), 1)
  offset greatest(coalesce(p_offset, 0), 0);
$function$;

grant execute on function public.list_author_posts(text[], integer, integer) to anon;
grant execute on function public.list_author_posts(text[], integer, integer) to authenticated;
grant execute on function public.list_author_posts(text[], integer, integer) to service_role;

-- Listing functions take the datasource alias as an argument.
--
-- list_authors, list_author_posts, list_categories and list_category_posts
-- (20260928210000, 20260928230000) named 'tech-article-staging' in their
-- bodies. Nothing else in them is the Tech's: they read only symbiont's
-- generic columns. Taking the alias as an argument, as list_unique_tags already
-- does, keeps them liftable into symbiont's half of the schema unchanged if
-- the library ever exposes them. See the note on section 5 of
-- supabase/schemas/20_tech_feed.sql, which this mirrors.
--
-- DROP first: a changed argument list is a new overload in Postgres, not a
-- replacement, so CREATE OR REPLACE alone would leave the old versions callable
-- alongside the new. Safe to drop because nothing deployed calls them yet --
-- the routes that do ship in the same release as this migration.

drop function if exists public.list_authors();
drop function if exists public.list_author_posts(text[], integer, integer);
drop function if exists public.list_categories();
drop function if exists public.list_category_posts(text[], integer, integer);


-- ---------------------------------------------------------------------------
-- 5. list_authors -- every credited writer, for /authors and slug resolution
--
-- Sections 5-8 take the datasource alias as an argument rather than naming
-- 'tech-article-staging', like list_unique_tags (section 2). Nothing in them is
-- specific to the Tech: they read only symbiont's generic columns. They live
-- here, not in 10_symbiont_core.sql, because the library does not call them;
-- if symbiont ever exposes them through its client (listCategories(alias) and
-- the like), they move to 10_ in that same change, and the argument is what
-- makes that a move rather than a rewrite.
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
create or replace function public.list_authors(p_datasource_alias text)
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
    p."datasource_alias" = p_datasource_alias
    and btrim(a.name) <> ''
  group by btrim(a.name)
  order by btrim(a.name);
$function$;

grant execute on function public.list_authors(text) to anon;
grant execute on function public.list_authors(text) to authenticated;
grant execute on function public.list_authors(text) to service_role;


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
  p_datasource_alias text,
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
    p."datasource_alias" = p_datasource_alias
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

grant execute on function public.list_author_posts(text, text[], integer, integer) to anon;
grant execute on function public.list_author_posts(text, text[], integer, integer) to authenticated;
grant execute on function public.list_author_posts(text, text[], integer, integer) to service_role;


-- ---------------------------------------------------------------------------
-- 7. list_categories -- every tag in use, for /categories and slug resolution
--
-- The category twin of list_authors (section 5), and trimmed and merged the
-- same way: trimming here, slug-merging in the app (src/lib/utils/slug.ts).
--
-- Internal tags (`web submission` and the like) are not filtered here. The
-- sync drops them before they reach pages.tags -- see INTERNAL_TAGS in
-- src/lib/sync/properties.ts -- so the list lives in one place.
-- ---------------------------------------------------------------------------
create or replace function public.list_categories(p_datasource_alias text)
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
    btrim(t.name)           as name,
    count(*)::integer       as article_count,
    max(p."publish_at")     as latest_publish_at
  from public.pages p
  cross join lateral jsonb_array_elements_text(
    case when jsonb_typeof(p."tags") = 'array' then p."tags" else '[]'::jsonb end
  ) as t(name)
  where
    p."datasource_alias" = p_datasource_alias
    and btrim(t.name) <> ''
  group by btrim(t.name)
  order by btrim(t.name);
$function$;

grant execute on function public.list_categories(text) to anon;
grant execute on function public.list_categories(text) to authenticated;
grant execute on function public.list_categories(text) to service_role;


-- ---------------------------------------------------------------------------
-- 8. list_category_posts -- one category's articles, newest first
--
-- The twin of list_author_posts (section 6): an array of spellings in, row
-- pagination, total_posts as a window count, the same cover join.
-- ---------------------------------------------------------------------------
create or replace function public.list_category_posts(
  p_datasource_alias text,
  p_tags   text[],
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
    p."datasource_alias" = p_datasource_alias
    and exists (
      select 1
      from jsonb_array_elements_text(
        case when jsonb_typeof(p."tags") = 'array' then p."tags" else '[]'::jsonb end
      ) as t(name)
      where btrim(t.name) = any(p_tags)
    )
  order by p."publish_at" desc nulls last, p."page_id"
  limit greatest(least(coalesce(p_limit, 30), 100), 1)
  offset greatest(coalesce(p_offset, 0), 0);
$function$;

grant execute on function public.list_category_posts(text, text[], integer, integer) to anon;
grant execute on function public.list_category_posts(text, text[], integer, integer) to authenticated;
grant execute on function public.list_category_posts(text, text[], integer, integer) to service_role;

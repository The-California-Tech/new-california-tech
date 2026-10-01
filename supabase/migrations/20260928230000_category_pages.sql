-- Category pages: /categories and /categories/[category].
--
-- Mirrors sections 7 and 8 of supabase/schemas/20_tech_feed.sql (the source),
-- plus a one-off data fix that has no place in the declarative schema.
--
-- The functions are additive and safe to apply ahead of the deploy that calls
-- them.

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
create or replace function public.list_categories()
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
    p."datasource_alias" = 'tech-article-staging'
    and btrim(t.name) <> ''
  group by btrim(t.name)
  order by btrim(t.name);
$function$;

grant execute on function public.list_categories() to anon;
grant execute on function public.list_categories() to authenticated;
grant execute on function public.list_categories() to service_role;


-- ---------------------------------------------------------------------------
-- 8. list_category_posts -- one category's articles, newest first
--
-- The twin of list_author_posts (section 6): an array of spellings in, row
-- pagination, total_posts as a window count, the same cover join.
-- ---------------------------------------------------------------------------
create or replace function public.list_category_posts(
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
    p."datasource_alias" = 'tech-article-staging'
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

grant execute on function public.list_category_posts(text[], integer, integer) to anon;
grant execute on function public.list_category_posts(text[], integer, integer) to authenticated;
grant execute on function public.list_category_posts(text[], integer, integer) to service_role;


-- ---------------------------------------------------------------------------
-- One-off: remove internal tags from rows already synced.
--
-- From now on the sync drops these before they reach pages.tags
-- (publicTagsHook, INTERNAL_TAGS in src/lib/sync/properties.ts). Rows synced
-- before that still carry them -- 58 carried `web submission` -- and the poll
-- only re-syncs pages that changed. post-converter used to hide two of them at
-- render time, but not from anything that reads pages.tags directly: the feeds,
-- search, and now list_categories().
--
-- The names are repeated here rather than read from the app because a
-- migration is a record of what was done at the time. If INTERNAL_TAGS grows,
-- that is a new migration, not an edit to this one.
--
-- jsonb `-` with a text operand removes matching array elements; rows without
-- any of these tags are not touched (the `?|` guard), so updated_at does not
-- move on them.
-- ---------------------------------------------------------------------------
update public.pages
set "tags" = "tags" - 'web submission' - 'Web Only' - 'No Sync' - 'Print Only' - 'Advertisement'
where
  jsonb_typeof("tags") = 'array'
  and "tags" ?| array['web submission', 'Web Only', 'No Sync', 'Print Only', 'Advertisement'];

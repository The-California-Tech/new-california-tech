drop function if exists "public"."handle_updated_at"();

set check_function_bodies = off;

drop view if exists "public"."homepage";

alter table "public"."pages" drop column if exists "search_fts";


alter table "public"."pages" add column "search_fts" tsvector generated always as ((((setweight(to_tsvector('english'::regconfig, COALESCE(title, ''::text)), 'A'::"char") || setweight(to_tsvector('english'::regconfig, COALESCE(summary, ''::text)), 'B'::"char")) || setweight(jsonb_to_tsvector('english'::regconfig, COALESCE(authors, '[]'::jsonb), '["string"]'::jsonb), 'B'::"char")) || setweight(to_tsvector('english'::regconfig, COALESCE(content, ''::text)), 'C'::"char"))) stored;

drop index if exists pages_search_fts_idx;

CREATE INDEX pages_search_fts_idx ON public.pages USING gin (search_fts);


create or replace view "public"."homepage" with (security_invoker = on) 
as  
SELECT 
    cover,
    last_synced_at,
    summary,
    page_id,
    title,
    slug,
    publish_at,
    updated_at,
    datasource_id,
    datasource_alias,
    authors,
    tags,
    meta,
    search_fts
   FROM public.pages;


CREATE OR REPLACE FUNCTION public.list_unique_tags(p_datasource_alias text)
 RETURNS TABLE(tag text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$
;


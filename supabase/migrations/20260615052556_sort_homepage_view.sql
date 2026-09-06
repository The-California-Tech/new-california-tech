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
   FROM public.pages
   
  order by
    "publish_at" desc nulls last,
    case
      when jsonb_typeof("meta"->'layoutWeight') = 'number'
        then ("meta"->>'layoutWeight')::numeric
      else null
    end desc nulls last
    ;

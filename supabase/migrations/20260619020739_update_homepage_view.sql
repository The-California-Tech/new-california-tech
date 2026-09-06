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
  im."height" as "cover_height"
from "public"."pages" p
left join "public"."image_metadata" im
  on im."bucket_id" = 'media'
 and im."object_path" = case
   when p."cover" like 'https://xguzskbxiptvhbyggkpl.supabase.co/storage/v1/object/public/media/%'
     then nullif(split_part(split_part(p."cover", '/storage/v1/object/public/media/', 2), '?', 1), '')
   else null
 end
 where p.datasource_alias='tech-article-staging'
order by
  p."publish_at" desc nulls last,
  case
    when jsonb_typeof(p."meta"->'layoutWeight') = 'number'
      then (p."meta"->>'layoutWeight')::numeric
    else null
  end desc nulls last;
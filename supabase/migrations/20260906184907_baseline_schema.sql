create extension if not exists "hypopg" with schema "extensions";

create extension if not exists "index_advisor" with schema "extensions";


  create table "public"."image_metadata" (
    "id" bigint generated always as identity not null,
    "bucket_id" text not null,
    "object_path" text not null,
    "width" integer not null,
    "height" integer not null,
    "storage_object_id" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."image_metadata" enable row level security;


  create table "public"."pages" (
    "page_id" text not null,
    "title" text not null,
    "slug" text,
    "authors" jsonb default jsonb_build_array(),
    "tags" jsonb default jsonb_build_array(),
    "publish_at" timestamp with time zone,
    "meta" jsonb default jsonb_build_object(),
    "content" text,
    "summary" text,
    "cover" text,
    "last_synced_at" timestamp with time zone,
    "updated_at" timestamp with time zone not null,
    "datasource_id" text not null,
    "datasource_alias" text not null,
    "search_fts" tsvector generated always as ((((setweight(to_tsvector('english'::regconfig, COALESCE(title, ''::text)), 'A'::"char") || setweight(to_tsvector('english'::regconfig, COALESCE(summary, ''::text)), 'B'::"char")) || setweight(jsonb_to_tsvector('english'::regconfig, COALESCE(authors, '[]'::jsonb), '["string"]'::jsonb), 'B'::"char")) || setweight(to_tsvector('english'::regconfig, COALESCE(content, ''::text)), 'C'::"char"))) stored
      );


alter table "public"."pages" enable row level security;

CREATE INDEX idx_pages_datasource ON public.pages USING btree (datasource_id);

CREATE INDEX idx_pages_datasource_alias ON public.pages USING btree (datasource_alias);

CREATE INDEX idx_pages_datasource_alias_slug ON public.pages USING btree (datasource_alias, slug);

CREATE INDEX idx_pages_meta ON public.pages USING gin (meta);

CREATE INDEX idx_pages_publish_at ON public.pages USING btree (publish_at);

CREATE INDEX idx_pages_tags ON public.pages USING gin (tags);

CREATE INDEX image_metadata_bucket_path_idx ON public.image_metadata USING btree (bucket_id, object_path);

CREATE UNIQUE INDEX image_metadata_bucket_path_unique ON public.image_metadata USING btree (bucket_id, object_path);

CREATE UNIQUE INDEX image_metadata_pkey ON public.image_metadata USING btree (id);

CREATE UNIQUE INDEX image_metadata_storage_object_id_key ON public.image_metadata USING btree (storage_object_id);

CREATE UNIQUE INDEX pages_datasource_alias_slug_key ON public.pages USING btree (datasource_alias, slug);

CREATE UNIQUE INDEX pages_datasource_id_slug_key ON public.pages USING btree (datasource_id, slug);

CREATE UNIQUE INDEX pages_pkey ON public.pages USING btree (page_id);

CREATE INDEX pages_search_fts_idx ON public.pages USING gin (search_fts);

CREATE INDEX pages_summary_idx ON public.pages USING btree (summary);

CREATE INDEX pages_title_idx ON public.pages USING btree (title);

alter table "public"."image_metadata" add constraint "image_metadata_pkey" PRIMARY KEY using index "image_metadata_pkey";

alter table "public"."pages" add constraint "pages_pkey" PRIMARY KEY using index "pages_pkey";

alter table "public"."image_metadata" add constraint "image_metadata_bucket_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id) ON DELETE CASCADE not valid;

alter table "public"."image_metadata" validate constraint "image_metadata_bucket_fkey";

alter table "public"."image_metadata" add constraint "image_metadata_bucket_path_unique" UNIQUE using index "image_metadata_bucket_path_unique";

alter table "public"."image_metadata" add constraint "image_metadata_height_check" CHECK ((height > 0)) not valid;

alter table "public"."image_metadata" validate constraint "image_metadata_height_check";

alter table "public"."image_metadata" add constraint "image_metadata_storage_object_fkey" FOREIGN KEY (storage_object_id) REFERENCES storage.objects(id) ON DELETE CASCADE not valid;

alter table "public"."image_metadata" validate constraint "image_metadata_storage_object_fkey";

alter table "public"."image_metadata" add constraint "image_metadata_storage_object_id_key" UNIQUE using index "image_metadata_storage_object_id_key";

alter table "public"."image_metadata" add constraint "image_metadata_width_check" CHECK ((width > 0)) not valid;

alter table "public"."image_metadata" validate constraint "image_metadata_width_check";

alter table "public"."pages" add constraint "pages_datasource_alias_slug_key" UNIQUE using index "pages_datasource_alias_slug_key";

alter table "public"."pages" add constraint "pages_datasource_id_slug_key" UNIQUE using index "pages_datasource_id_slug_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.list_homepage_posts(p_query text DEFAULT NULL::text, p_tag text DEFAULT NULL::text, p_before_date date DEFAULT NULL::date, p_issue_offset integer DEFAULT 0, p_target_count integer DEFAULT 30)
 RETURNS TABLE(page_id text, title text, slug text, authors jsonb, tags jsonb, publish_at timestamp with time zone, updated_at timestamp with time zone, last_synced_at timestamp with time zone, meta jsonb, summary text, content_preview text, cover text, cover_width integer, cover_height integer, datasource_id text, datasource_alias text, issue_date date, issue_rank integer, total_issues integer, total_posts integer)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.list_storage_objects_recursive(p_bucket_id text, p_prefix text DEFAULT ''::text, p_limit integer DEFAULT 1000, p_after_name text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, name text, bucket_id text, owner uuid, created_at timestamp with time zone, updated_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'storage'
AS $function$
  select
    o.id,
    o.name,
    o.bucket_id,
    o.owner,
    o.created_at,
    o.updated_at,
    o.last_accessed_at,
    o.metadata
  from storage.objects as o
  where o.bucket_id = p_bucket_id
    and o.name like p_prefix || '%'
    and (p_after_name is null or o.name > p_after_name)
  order by o.name asc
  limit least(greatest(p_limit, 1), 1000);
$function$
;

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

CREATE OR REPLACE FUNCTION public.nearest_issue_date(p_target date)
 RETURNS date
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select d.issue_date
  from (
    select distinct (p."publish_at" at time zone 'America/Los_Angeles')::date as issue_date
    from public.pages p
    where p."datasource_alias" = 'tech-article-staging'
      and p."publish_at" is not null
  ) d
  order by abs(d.issue_date - p_target) asc, d.issue_date desc
  limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

grant select on table "public"."image_metadata" to "anon";

grant select on table "public"."image_metadata" to "authenticated";

grant delete on table "public"."image_metadata" to "service_role";

grant insert on table "public"."image_metadata" to "service_role";

grant select on table "public"."image_metadata" to "service_role";

grant update on table "public"."image_metadata" to "service_role";

grant select on table "public"."pages" to "anon";

grant select on table "public"."pages" to "authenticated";

grant delete on table "public"."pages" to "service_role";

grant insert on table "public"."pages" to "service_role";

grant select on table "public"."pages" to "service_role";

grant update on table "public"."pages" to "service_role";


  create policy "Public image metadata read"
  on "public"."image_metadata"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Service role full access"
  on "public"."image_metadata"
  as permissive
  for all
  to public
using ((auth.role() = 'service_role'::text))
with check ((auth.role() = 'service_role'::text));



  create policy "Public pages read access"
  on "public"."pages"
  as permissive
  for select
  to public
using (((publish_at IS NOT NULL) AND (publish_at <= now())));



  create policy "Service role full access"
  on "public"."pages"
  as permissive
  for all
  to public
using ((auth.role() = 'service_role'::text))
with check ((auth.role() = 'service_role'::text));


CREATE TRIGGER trg_image_metadata_set_updated_at BEFORE UPDATE ON public.image_metadata FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();



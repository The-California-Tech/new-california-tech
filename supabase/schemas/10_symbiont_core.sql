-- ===========================================================================
-- SYMBIONT-OWNED SCHEMA
--
-- Everything in this file belongs to the symbiont-cms library, not to the
-- California Tech. symbiont reads and writes these objects directly:
--
--   public.pages                        page-crud.ts, default-hooks.ts
--   public.image_metadata               image-upload.ts (dimension upserts)
--   public.set_updated_at()             trigger for image_metadata
--   list_storage_objects_recursive()    storage-cleanup.ts / media backfill
--
-- RULE OF THUMB: if symbiont-cms would break when you change it, it goes here.
-- Anything the Tech builds *on top* of these lives in 20_tech_feed.sql.
--
-- WHY THIS FILE EXISTS AT ALL: symbiont-cms currently ships no DDL, so every
-- consuming app has to hand-maintain the library's own tables. The intended
-- direction (see the v2.0.0 note in the project's Notion page) is for symbiont
-- to own and migrate its own schema -- ideally a dedicated `symbiont` Postgres
-- schema -- at which point this file gets replaced by a path into
-- node_modules/symbiont-cms and stops being your problem. Keeping the split
-- along ownership lines now makes that swap mechanical.
--
-- Ordering matters: image_metadata must exist before anything that joins it.
-- `schema_paths` in config.toml applies these files in numeric order.
-- ===========================================================================

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = on;

SET default_tablespace = '';
SET default_table_access_method = heap;

--
-- Extensions enabled on the hosted project. All three must be declared here or
-- `supabase db diff` emits `drop extension` for them.
--
--   pg_net    dropped in 20260120013952 and re-created in 20260120022203, so it
--             IS present in the final state -- easy to miss when reading the
--             migration chain top to bottom.
--   hypopg    \_ both pulled in by 20260616035324_remote_schema.sql;
--   index_advisor /  they back Supabase's index advisor.
--
create extension if not exists "pg_net" with schema "extensions";
create extension if not exists "hypopg" with schema "extensions";
create extension if not exists "index_advisor" with schema "extensions";


-- ---------------------------------------------------------------------------
-- public.pages -- symbiont's content table
-- ---------------------------------------------------------------------------
CREATE TABLE public.pages (
    page_id text NOT NULL,
    title text NOT NULL,
    slug text,
    authors jsonb DEFAULT jsonb_build_array(),
    tags jsonb DEFAULT jsonb_build_array(),
    publish_at timestamp with time zone,
    meta jsonb DEFAULT jsonb_build_object(),
    content text,
    summary text,
    cover text,
    last_synced_at timestamp with time zone,
    updated_at timestamp with time zone NOT NULL,
    datasource_id text NOT NULL,
    datasource_alias text NOT NULL
);

COMMENT ON COLUMN public.pages.datasource_alias IS 'Non-secret alias for datasource (used by public queries).';

ALTER TABLE ONLY public.pages
    ADD CONSTRAINT pages_datasource_alias_slug_key UNIQUE (datasource_alias, slug);

ALTER TABLE ONLY public.pages
    ADD CONSTRAINT pages_datasource_id_slug_key UNIQUE (datasource_id, slug);

ALTER TABLE ONLY public.pages
    ADD CONSTRAINT pages_pkey PRIMARY KEY (page_id);

CREATE INDEX idx_pages_datasource ON public.pages USING btree (datasource_id);
CREATE INDEX idx_pages_datasource_alias ON public.pages USING btree (datasource_alias);
CREATE INDEX idx_pages_datasource_alias_slug ON public.pages USING btree (datasource_alias, slug);
CREATE INDEX idx_pages_meta ON public.pages USING gin (meta);
CREATE INDEX idx_pages_publish_at ON public.pages USING btree (publish_at);
CREATE INDEX idx_pages_tags ON public.pages USING gin (tags);
CREATE INDEX pages_summary_idx ON public.pages USING btree (summary);
CREATE INDEX pages_title_idx ON public.pages USING btree (title);

ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;

-- This policy is the only thing keeping unpublished and future-scheduled
-- articles out of public reads. Anything querying pages as `anon` depends on it.
CREATE POLICY "Public pages read access" ON public.pages
  FOR SELECT USING ((publish_at IS NOT NULL) AND (publish_at <= NOW()));

CREATE POLICY "Service role full access" ON public.pages
  FOR ALL USING ((auth.role() = 'service_role'::text))
  WITH CHECK ((auth.role() = 'service_role'::text));

-- The REVOKEs are required, not cosmetic. Supabase ships ALTER DEFAULT
-- PRIVILEGES on `public`, so a table created fresh from this file picks up the
-- full privilege set (including REFERENCES, TRIGGER and TRUNCATE) for
-- anon/authenticated/service_role before the grants below apply. Without these,
-- `supabase db diff` reports the difference in reverse and tries to re-grant
-- TRUNCATE to anon. TRUNCATE is NOT subject to RLS.
revoke insert, update, delete, truncate, references, trigger
  on table public.pages from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.pages from authenticated;
revoke truncate, references, trigger
  on table public.pages from service_role;

grant select on table public.pages to anon;
grant select on table public.pages to authenticated;
grant select, insert, update, delete on table public.pages to service_role;


-- ---------------------------------------------------------------------------
-- public.image_metadata -- pixel dimensions for uploaded media
--
-- Written by symbiont's uploadImageToSupabase(), on both the fresh-upload and
-- already-in-storage paths. Read by consumers that want to reserve layout space
-- and avoid CLS.
-- ---------------------------------------------------------------------------
create table if not exists public.image_metadata (
  id bigint generated always as identity primary key,

  bucket_id text not null,
  object_path text not null,

  width integer not null check (width > 0),
  height integer not null check (height > 0),

  storage_object_id uuid unique,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint image_metadata_bucket_path_unique unique (bucket_id, object_path),

  constraint image_metadata_bucket_fkey
    foreign key (bucket_id)
    references storage.buckets (id)
    on delete cascade,

  constraint image_metadata_storage_object_fkey
    foreign key (storage_object_id)
    references storage.objects (id)
    on delete cascade
);

create index if not exists image_metadata_bucket_path_idx
  on public.image_metadata (bucket_id, object_path);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_image_metadata_set_updated_at on public.image_metadata;

create trigger trg_image_metadata_set_updated_at
before update on public.image_metadata
for each row
execute function public.set_updated_at();

alter table public.image_metadata enable row level security;

-- Public read is required: consumers join this table while running as `anon`,
-- and RLS default-denies. Without a permissive SELECT policy the join silently
-- yields NULL dimensions with no error -- which is exactly how this was broken
-- until 2026-08-22. Image dimensions carry no confidential information.
drop policy if exists "Public image metadata read" on public.image_metadata;
create policy "Public image metadata read"
  on public.image_metadata
  as permissive
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Service role full access" on public.image_metadata;
create policy "Service role full access"
  on public.image_metadata
  as permissive
  for all
  to public
  using ((auth.role() = 'service_role'::text))
  with check ((auth.role() = 'service_role'::text));

-- Same ALTER DEFAULT PRIVILEGES caveat as public.pages -- revoke before grant.
revoke insert, update, delete, truncate, references, trigger
  on table public.image_metadata from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.image_metadata from authenticated;
revoke truncate, references, trigger
  on table public.image_metadata from service_role;

grant select on table public.image_metadata to anon;
grant select on table public.image_metadata to authenticated;
grant select, insert, update, delete on table public.image_metadata to service_role;

-- Keep the trigger function unreachable from the API. Calling it directly errors
-- out rather than doing damage, but Postgres grants EXECUTE to PUBLIC by default
-- and there is no reason for it to be exposed.
revoke all on function public.set_updated_at() from public;
revoke all on function public.set_updated_at() from anon;
revoke all on function public.set_updated_at() from authenticated;


-- ---------------------------------------------------------------------------
-- public.list_storage_objects_recursive -- media bucket enumeration
--
-- Service-role only, and the grants below are REQUIRED rather than decorative:
-- Postgres grants EXECUTE on new functions to PUBLIC by default, which anon
-- inherits. Omitting grants does NOT mean "service role only" -- that mistake
-- is what left this callable by anon until 2026-08-22.
--
-- Why it matters: the `media` bucket is public, so any policy letting the web
-- client read objects also lets it enumerate them through this function. That
-- exposes unlinked files, e.g. issue PDFs uploaded before their release date.
-- Enumeration is a distinct capability from fetching a known URL.
-- ---------------------------------------------------------------------------
create or replace function public.list_storage_objects_recursive(
  p_bucket_id text,
  p_prefix text default ''::text,
  p_limit integer default 1000,
  p_after_name text default null
)
returns table(
  id uuid,
  name text,
  bucket_id text,
  owner uuid,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  last_accessed_at timestamp with time zone,
  metadata jsonb
)
language sql
stable
set search_path to 'pg_catalog', 'storage'
as $function$
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
$function$;

revoke all on function public.list_storage_objects_recursive(text, text, integer, text) from public;
revoke all on function public.list_storage_objects_recursive(text, text, integer, text) from anon;
revoke all on function public.list_storage_objects_recursive(text, text, integer, text) from authenticated;
grant execute on function public.list_storage_objects_recursive(text, text, integer, text) to service_role;

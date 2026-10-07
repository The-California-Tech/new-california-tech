-- Share links for web-edited articles (/share/<token>).
-- Mirrors section 9 of supabase/schemas/20_tech_feed.sql. Additive only.

-- ---------------------------------------------------------------------------
-- 9. share_links -- edit and read-only links to web-edited articles
--
-- A link is /share/<token>. Only a SHA-256 of the token is stored, so a leak of
-- this table does not leak working links. `read_only` links are the ones put in
-- the Notion page for editors; the writer gets an editable one. Whether an
-- editable link can actually edit also depends on the article: only while its
-- Source of Truth is Database (meta.contentSource), checked by the route.
--
-- Server-only. RLS is on with no policies, and only service_role is granted,
-- so anon and authenticated cannot read it even if a grant is added by mistake
-- later. App-owned, referencing symbiont's pages: extend, don't fork. ON DELETE
-- CASCADE because a link to a deleted article is meaningless.
-- ---------------------------------------------------------------------------
create table if not exists public.share_links (
  token_hash text primary key,
  page_id    text not null references public.pages (page_id) on delete cascade,
  read_only  boolean not null default false,
  created_at timestamp with time zone not null default now()
);

create index if not exists share_links_page_id_idx on public.share_links (page_id);

alter table public.share_links enable row level security;

grant select, insert, update, delete on table public.share_links to service_role;

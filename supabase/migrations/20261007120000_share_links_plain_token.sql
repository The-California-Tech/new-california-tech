-- share_links: store the token itself, one edit link per article.
--
-- 20261006120000 stored a SHA-256 of each token. That only protects links if
-- this table leaks, but the same links now sit in Notion in clear (the
-- placeholder body and the Info line), and service_role -- the only role that
-- can read this table -- can write pages.content anyway. Storing the token lets
-- the sync find a page's link by page, instead of parsing it back out of Info.
--
-- The table was empty in production when this was written (no submission had
-- run the new code), so renaming the column changes no data. Mirrors section 9
-- of supabase/schemas/20_tech_feed.sql.

alter table public.share_links rename column token_hash to token;

create unique index if not exists share_links_one_edit_link
  on public.share_links (page_id) where not read_only;

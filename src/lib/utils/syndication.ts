/**
 * Shared helpers for the syndication endpoints: atom.xml, feed.json, sitemap.xml.
 *
 * These three used to each build their own fields inline, which is how they
 * drifted apart and accumulated the same bugs in slightly different forms
 * (raw markdown served as type="html", unescaped tags in XML attributes, one
 * endpoint guarding a null slug and another not). Everything shared now lives
 * here so a fix lands in all three at once.
 *
 * NOTE ON PRIVACY: every read here goes through the symbiont client, which is
 * configured with the *publishable* (anon) key. That matters -- the "Public
 * pages read access" RLS policy on public.pages is what keeps articles with a
 * future publish_at out of the public feeds and sitemap. Do not switch these
 * endpoints to a service-role client to "fix" a missing row; that would
 * publish embargoed articles.
 */
import { siteConfig } from '#config/site.ts';
import { appDb } from '#lib/utils/app-db.ts';

/** The live article set. Despite the name, this is production, not staging -- */
/** public.list_homepage_posts hardcodes the same alias for the homepage feed. */
export const ARTICLE_ALIAS = 'tech-article-staging';

/** Static site pages (About, Masthead, ...), served at /<slug>. */
export const SITE_PAGE_ALIAS = 'tech-website-pages';

/** A row of public.pages, loosely typed -- these endpoints touch few fields. */
export type SyndicationPage = {
  slug?: string | null;
  title?: string | null;
  summary?: string | null;
  content?: string | null;
  cover?: string | null;
  authors?: string[] | null;
  tags?: string[] | null;
  publish_at?: string | null;
  updated_at?: string | null;
};

/**
 * Escape a value for XML text or a double-quoted attribute.
 *
 * Used instead of CDATA on purpose. CDATA looks convenient but silently breaks
 * on a literal `]]>` anywhere in the body -- and article text absolutely can
 * contain that (any code block discussing XML will). Entity-escaping has no
 * such edge case. It also drops the C0 control characters that are simply
 * illegal in XML 1.0 and make a feed unparseable rather than merely ugly.
 */
export function escapeXml(value: unknown): string {
  return (
    String(value ?? '')
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  );
}

/** Absolute URL for a site-relative path. Feeds and sitemaps require absolute. */
export function absoluteUrl(path: string): string {
  const base = siteConfig.url.endsWith('/') ? siteConfig.url : `${siteConfig.url}/`;
  return new URL(String(path ?? '').replace(/^\/+/, ''), base).href;
}

/** Public URL of an article or site page. Both are served at /<slug>. */
export function pageUrl(page: SyndicationPage): string | null {
  const slug = page.slug?.trim();
  if (!slug) return null; // no ?? '/' fallback: that emitted the homepage, or
  return absoluteUrl(slug); // literally "/undefined", as one entry per bad row
}

/**
 * RFC 3339 timestamp, or null if the input is missing or unparseable.
 *
 * Both Atom and JSON Feed require RFC 3339. feed.json previously passed
 * publish_at straight through, which is a Postgres timestamptz rendering
 * ("2026-09-06 12:00:00+00") -- close enough to look right, not actually valid.
 */
export function rfc3339(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Strip enough markdown to make a readable plain-text excerpt. Not a parser. */
function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/^---\n[\s\S]*?\n---/, '') // frontmatter
    .replace(/```[\s\S]*?```/g, '') // fenced code
    .replace(/`([^`]*)`/g, '$1') // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links -> link text
    .replace(/^\s{0,3}#{1,6}\s+/gm, '') // headings
    .replace(/^\s{0,3}>\s?/gm, '') // blockquotes
    .replace(/^\s{0,3}([-*_])\s*\1\s*\1[\s*_-]*$/gm, '') // thematic breaks
    .replace(/^\s{0,3}[-*+]\s+/gm, '') // bullets
    .replace(/(\*\*|__|\*|_|~~)/g, '') // emphasis
    .replace(/<[^>]+>/g, '') // stray html
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * A plain-text excerpt for the feeds.
 *
 * Prefers the editor-written `summary` column. The old code ignored it and used
 * `content.substring(0, 200)`, which took a hard 200-*code-unit* slice of raw
 * markdown -- so excerpts ended mid-word, could end mid-link-syntax, and could
 * split a surrogate pair (half an emoji) and produce invalid output. This falls
 * back to content only when there is no summary, strips the markup first, and
 * cuts on a word boundary using code points rather than UTF-16 units.
 */
export function excerpt(page: SyndicationPage, maxLength = 280): string {
  const summary = page.summary?.trim();
  if (summary) return summary;

  const text = stripMarkdown(page.content ?? '');
  const points = Array.from(text);
  if (points.length <= maxLength) return text;

  const clipped = points.slice(0, maxLength).join('');
  const lastSpace = clipped.lastIndexOf(' ');
  return `${(lastSpace > maxLength * 0.6 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…`;
}

/** Article author names, falling back to the paper itself. */
export function authorNames(page: SyndicationPage): string[] {
  const names = (page.authors ?? []).map((name) => String(name).trim()).filter(Boolean);
  return names.length ? names : [siteConfig.author?.name ?? siteConfig.title];
}

/** What the sitemap needs from a row: its URL and when it last changed. */
export type SitemapRow = Pick<SyndicationPage, 'slug' | 'publish_at' | 'updated_at'>;

/**
 * Every public row for an alias, with only the columns the sitemap uses.
 *
 * This used to page through symbiont.getAllPages(), which selects `*` -- so
 * each sitemap render pulled the full markdown of every article to read three
 * fields from it. On launch day, with crawlers fetching /sitemap.xml, that was
 * part of what pushed the database into statement timeouts.
 *
 * Read through appDb(), the same publishable-key client, so the RLS note
 * above still holds. Ordered by page_id so offset paging is stable.
 *
 * pageSize stays well under PostgREST's 1000-row ceiling. maxPages is a guard
 * against looping forever; hitting it logs rather than throwing, because a
 * truncated sitemap is much better than a 500 on /sitemap.xml.
 */
export async function fetchSitemapRows(
  fetch: typeof globalThis.fetch,
  alias: string,
  { pageSize = 500, maxPages = 40 }: { pageSize?: number; maxPages?: number } = {},
): Promise<SitemapRow[]> {
  const db = appDb(fetch);
  const all: SitemapRow[] = [];

  for (let index = 0; index < maxPages; index++) {
    const { data, error } = await db
      .from('pages')
      .select('slug, publish_at, updated_at')
      .eq('datasource_alias', alias)
      .order('page_id')
      .range(index * pageSize, (index + 1) * pageSize - 1);
    if (error) throw new Error(`[syndication] ${alias}: ${error.message}`);

    all.push(...data);
    if (data.length < pageSize) return all;
  }

  console.warn(`[syndication] hit maxPages (${maxPages}) for alias "${alias}"; output is truncated`);
  return all;
}

/**
 * Cache headers for the syndication endpoints.
 *
 * These render from a DB read on every request and were previously uncached, so
 * each crawler or feed-reader hit refetched a full page of article bodies.
 * max-age=0 keeps browsers honest while s-maxage lets the CDN absorb the load;
 * stale-while-revalidate means a cold cache never blocks a crawler.
 */
export const SYNDICATION_CACHE_CONTROL = 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';

/**
 * How many articles the feeds carry.
 *
 * A feed is a "what's new" channel, not an archive -- readers fetch it
 * repeatedly and only care about the recent end. The sitemap is where the full
 * archive belongs, and it lists everything.
 */
export const FEED_ITEM_LIMIT = 50;

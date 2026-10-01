/**
 * Author and category listings: the app's only callers of list_authors /
 * list_author_posts and list_categories / list_category_posts (sections 5-8 of
 * supabase/schemas/20_tech_feed.sql).
 *
 * The two are the same shape -- a Notion multi_select value becomes a page --
 * so they share this code, and differ only in which functions they call and
 * how they slug. The SQL takes the datasource as an argument (see section 5
 * of 20_tech_feed.sql for why); the choice of articles is made here.
 */
import { symbiontToTechArticle, type TechPageRow } from '$lib/utils/post-converter';
import { authorSlug } from '$lib/utils/authors';
import { categorySlug } from '$lib/utils/categories';
import type { Post } from '$lib/types/post';
import type { AppDb } from '$lib/utils/app-db';
import { ARTICLES_ALIAS } from '$lib/symbiont';

export const LISTING_PAGE_SIZE = 30;

export interface ListingSummary {
  /** Display name: the most-used spelling among those that share the slug. */
  name: string;
  slug: string;
  articleCount: number;
  latestPublishAt: string | null;
  /** Every spelling that produces this slug; the post query takes them all. */
  names: string[];
}

interface CountRow {
  name: string;
  article_count: number;
  latest_publish_at: string | null;
}

/**
 * One entry per slug, sorted by name.
 *
 * Merging happens here, not in SQL, because the slug is defined once, in
 * slug.ts. The display name is the spelling used most often, on the theory
 * that the one editors picked most is the intended one.
 *
 * Summing counts can double-count a piece that carries two spellings of the
 * same value. Rare, and only a figure on an index page; the listing page
 * itself counts distinct articles.
 */
function mergeBySlug(rows: CountRow[], slugOf: (name: string) => string): ListingSummary[] {
  const bySlug = new Map<string, ListingSummary & { topCount: number }>();

  for (const row of rows) {
    const slug = slugOf(row.name);
    if (!slug) continue;
    const entry = bySlug.get(slug);
    if (!entry) {
      bySlug.set(slug, {
        name: row.name,
        slug,
        names: [row.name],
        articleCount: row.article_count,
        latestPublishAt: row.latest_publish_at,
        topCount: row.article_count,
      });
      continue;
    }
    entry.names.push(row.name);
    entry.articleCount += row.article_count;
    if (row.article_count > entry.topCount) {
      entry.name = row.name;
      entry.topCount = row.article_count;
    }
    if (row.latest_publish_at && (!entry.latestPublishAt || row.latest_publish_at > entry.latestPublishAt)) {
      entry.latestPublishAt = row.latest_publish_at;
    }
  }

  return [...bySlug.values()]
    .map(({ topCount: _topCount, ...entry }) => entry)
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}

export async function fetchAuthors(client: AppDb): Promise<ListingSummary[]> {
  const { data, error } = await client.rpc('list_authors', { p_datasource_alias: ARTICLES_ALIAS });
  if (error) throw new Error(`list_authors failed: ${error.message}`);
  return mergeBySlug(data ?? [], authorSlug);
}

export async function fetchCategories(client: AppDb): Promise<ListingSummary[]> {
  const { data, error } = await client.rpc('list_categories', { p_datasource_alias: ARTICLES_ALIAS });
  if (error) throw new Error(`list_categories failed: ${error.message}`);
  return mergeBySlug(data ?? [], categorySlug);
}

export interface ListingPage {
  posts: Post.Post[];
  total: number;
}

interface PageOptions {
  limit?: number;
  offset?: number;
}

type PostRows = { data: unknown[] | null; error: { message: string } | null };

function toPage(fn: string, { data, error }: PostRows): ListingPage {
  if (error) throw new Error(`${fn} failed: ${error.message}`);
  // The generator types every function column non-null and every jsonb as
  // Json; the converter is where those get narrowed, defensively.
  const rows = (data ?? []) as Array<TechPageRow & { total_posts?: number | null }>;
  return {
    posts: rows.map((row) => symbiontToTechArticle(row)),
    total: rows[0]?.total_posts ?? 0,
  };
}

export async function fetchAuthorPosts(
  client: AppDb,
  names: string[],
  { limit = LISTING_PAGE_SIZE, offset = 0 }: PageOptions = {},
): Promise<ListingPage> {
  return toPage(
    'list_author_posts',
    await client.rpc('list_author_posts', {
      p_datasource_alias: ARTICLES_ALIAS,
      p_names: names,
      p_limit: limit,
      p_offset: offset,
    }),
  );
}

export async function fetchCategoryPosts(
  client: AppDb,
  tags: string[],
  { limit = LISTING_PAGE_SIZE, offset = 0 }: PageOptions = {},
): Promise<ListingPage> {
  return toPage(
    'list_category_posts',
    await client.rpc('list_category_posts', {
      p_datasource_alias: ARTICLES_ALIAS,
      p_tags: tags,
      p_limit: limit,
      p_offset: offset,
    }),
  );
}

/**
 * Shared wrapper around the `list_homepage_posts` Postgres function.
 *
 * The feed's issue-boundary rule (a page never ends mid-issue) now lives in
 * SQL — see supabase/schemas/20_tech_feed.sql (the app-owned half of the
 * schema; symbiont's own objects live in 10_symbiont_core.sql).
 * This module is the single place the app calls it, so the homepage loader, the
 * previews API and the per-issue page cannot drift apart.
 *
 * Pagination is by *issue*, not by row. `issueRank` from one page is the
 * `issueOffset` for the next. A row offset would drift as soon as one issue got
 * extended to its boundary.
 */
import { symbiontToTechArticle, type TechPageRow } from '$lib/utils/post-converter';
import type { Post } from '$lib/types/post';

export const FEED_BATCH_SIZE = 30;

/** Row shape returned by list_homepage_posts. */
export interface FeedRow extends TechPageRow {
  issue_date: string | null;
  issue_rank: number | null;
  total_issues: number | null;
  total_posts: number | null;
}

export interface FeedPage {
  posts: Post.Post[];
  /** Cursor: pass back as `issueOffset` to get the next page. */
  issueRank: number;
  totalIssues: number;
  totalPosts: number;
  hasMore: boolean;
}

export interface FeedQueryOptions {
  /** Full-text search, matched with websearch_to_tsquery against search_fts. */
  query?: string;
  /** Single tag; matched with the jsonb `?` operator against pages.tags. */
  tag?: string;
  /** Only issues on or before this Pacific date (YYYY-MM-DD). */
  beforeDate?: string;
  /** Whole issues to skip. */
  issueOffset?: number;
  /** Soft row target; the boundary issue is always returned whole. */
  targetCount?: number;
}

/**
 * Structural type instead of `SupabaseClient` from '@supabase/supabase-js':
 * that package is a transitive dependency via symbiont-cms, not a direct one, so
 * importing its types here does not resolve.
 *
 * The loose `rpc` signature is also doing real work. `list_homepage_posts` is
 * newer than the generated Database types shipped by symbiont-cms, so a typed
 * client would reject the call outright. Regenerating database.types.ts in
 * symbiont-cms after applying the migration is what makes this narrowable.
 */
type RpcCapable = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: FeedRow[] | null; error: { message: string } | null }>;
};

async function callListHomepagePosts(client: unknown, options: FeedQueryOptions, targetCount: number) {
  const { data, error } = await (client as unknown as RpcCapable).rpc('list_homepage_posts', {
    p_query: options.query?.trim() || null,
    p_tag: options.tag?.trim() || null,
    p_before_date: options.beforeDate?.trim() || null,
    p_issue_offset: Math.max(0, options.issueOffset ?? 0),
    p_target_count: targetCount,
  });

  if (error) {
    throw new Error(`list_homepage_posts failed: ${error.message}`);
  }

  return data ?? [];
}

export interface IssuePosts {
  posts: Post.Post[];
  /**
   * The issue actually returned, which is NOT always the one asked for. Under a
   * search or tag filter the requested issue may contain no matching articles,
   * in which case the query falls through to the next older issue that does.
   * Callers must compare this against what they requested.
   */
  issueDate: string | null;
  totalIssues: number;
  totalPosts: number;
}

/**
 * Every article in exactly one issue, and nothing else.
 *
 * This leans on an existing property of list_homepage_posts rather than adding
 * a new function: the boundary issue is always returned whole, so a target of
 * one row resolves to precisely one issue's worth of articles. (See `selected`
 * in 20_tech_feed.sql -- `cume - post_count < 1` can only hold for the first
 * issue at or before p_before_date.)
 *
 * Backs /issues/[date], which is a bounded page. It used to call fetchFeedPage
 * with beforeDate set, which returns the named issue *plus every older one* and
 * then infinite-scrolled further back -- so the URL named one issue while the
 * page showed the whole archive from that point on.
 *
 * The explicit filter on issue_date is defensive rather than load-bearing: it
 * costs nothing and means a future change to the SQL's boundary rule degrades
 * into a short page instead of silently un-bounding this route again.
 */
export async function fetchIssuePosts(
  client: unknown,
  options: { issueDate: string; query?: string; tag?: string },
): Promise<IssuePosts> {
  const rows = await callListHomepagePosts(
    client,
    { query: options.query, tag: options.tag, beforeDate: options.issueDate, issueOffset: 0 },
    1,
  );

  const issueDate = rows[0]?.issue_date ?? null;
  const issueRows = issueDate === null ? [] : rows.filter((row) => row.issue_date === issueDate);

  return {
    posts: issueRows.map((row) => symbiontToTechArticle(row)),
    issueDate,
    totalIssues: rows[0]?.total_issues ?? 0,
    totalPosts: rows[0]?.total_posts ?? 0,
  };
}

export async function fetchFeedPage(client: unknown, options: FeedQueryOptions = {}): Promise<FeedPage> {
  const issueOffset = Math.max(0, options.issueOffset ?? 0);
  const targetCount = Math.max(1, options.targetCount ?? FEED_BATCH_SIZE);

  const rows = await callListHomepagePosts(client, options, targetCount);
  const posts = rows.map((row) => symbiontToTechArticle(row));

  // total_issues / total_posts are constant across the result set.
  const totalIssues = rows[0]?.total_issues ?? 0;
  const totalPosts = rows[0]?.total_posts ?? 0;

  // Highest issue_rank in this page is the cursor for the next one.
  const issueRank = rows.reduce((max, row) => Math.max(max, row.issue_rank ?? 0), issueOffset);

  return {
    posts,
    issueRank,
    totalIssues,
    totalPosts,
    hasMore: issueRank < totalIssues,
  };
}

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
		args: Record<string, unknown>
	) => PromiseLike<{ data: FeedRow[] | null; error: { message: string } | null }>;
};

export async function fetchFeedPage(
	client: unknown,
	options: FeedQueryOptions = {}
): Promise<FeedPage> {
	const issueOffset = Math.max(0, options.issueOffset ?? 0);
	const targetCount = Math.max(1, options.targetCount ?? FEED_BATCH_SIZE);

	const { data, error } = await (client as unknown as RpcCapable).rpc('list_homepage_posts', {
		p_query: options.query?.trim() || null,
		p_tag: options.tag?.trim() || null,
		p_before_date: options.beforeDate?.trim() || null,
		p_issue_offset: issueOffset,
		p_target_count: targetCount
	});

	if (error) {
		throw new Error(`list_homepage_posts failed: ${error.message}`);
	}

	const rows = data ?? [];
	const posts = rows.map((row) => symbiontToTechArticle(row));

	// total_issues / total_posts are constant across the result set.
	const totalIssues = rows[0]?.total_issues ?? 0;
	const totalPosts = rows[0]?.total_posts ?? 0;

	// Highest issue_rank in this page is the cursor for the next one.
	const issueRank = rows.reduce(
		(max, row) => Math.max(max, row.issue_rank ?? 0),
		issueOffset
	);

	return {
		posts,
		issueRank,
		totalIssues,
		totalPosts,
		hasMore: issueRank < totalIssues
	};
}

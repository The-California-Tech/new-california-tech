import { redirect, isRedirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { symbiont } from '$lib/symbiont';
import { fetchFeedPage, FEED_BATCH_SIZE } from '$lib/utils/feed-query';
import { parsePositiveInt } from '$lib/utils/post-pagination';

export const config = {
	maxage: 60,
	revalidate: 60
};

export const prerender = false;

/**
 * `nearest_issue_date` is newer than the generated Database types shipped by
 * symbiont-cms. See the same note in feed-query.ts.
 */
type RpcCapable = {
	rpc: (
		fn: string,
		args: Record<string, unknown>
	) => PromiseLike<{ data: string | null; error: { message: string } | null }>;
};

export const load: PageServerLoad = async ({ fetch, params, url, cookies }) => {
	const theme = cookies.get('theme') || 'light';
	const requestedIssueDate = params.date;

	const emptyState = {
		posts: [],
		query: '',
		tag: '',
		hasMore: false,
		shownCount: 0,
		issueCursor: 0,
		nextCount: FEED_BATCH_SIZE,
		batchSize: FEED_BATCH_SIZE,
		totalCount: 0,
		issueDate: requestedIssueDate,
		theme
	};

	try {
		const query = url.searchParams.get('q')?.toLowerCase() || '';
		const tag = url.searchParams.get('tag') || '';
		const requestedCount = parsePositiveInt(url.searchParams.get('count'), FEED_BATCH_SIZE);

		const client = symbiont.getSSRClient(fetch);

		// Snap to a real issue date. Previously this fetched up to 1000 rows just
		// to build the distinct-date list; Postgres can answer it directly.
		const { data: resolvedIssueDate, error: resolveError } = await (
			client as unknown as RpcCapable
		).rpc('nearest_issue_date', { p_target: requestedIssueDate });

		if (resolveError) {
			throw new Error(`nearest_issue_date failed: ${resolveError.message}`);
		}

		if (!resolvedIssueDate) {
			return { ...emptyState, query, tag };
		}

		if (resolvedIssueDate !== requestedIssueDate) {
			const redirectTarget = new URL(`/issues/${resolvedIssueDate}`, url.origin);
			redirectTarget.search = url.search;
			redirect(302, `${redirectTarget.pathname}${redirectTarget.search}`);
		}

		const page = await fetchFeedPage(client, {
			query,
			tag,
			beforeDate: resolvedIssueDate,
			targetCount: requestedCount
		});

		return {
			posts: page.posts,
			query,
			tag,
			hasMore: page.hasMore,
			shownCount: page.posts.length,
			issueCursor: page.issueRank,
			nextCount: page.posts.length + FEED_BATCH_SIZE,
			batchSize: FEED_BATCH_SIZE,
			totalCount: page.totalPosts,
			issueDate: resolvedIssueDate,
			theme
		};
	} catch (error) {
		// Let SvelteKit's redirect signal through instead of swallowing it as an
		// error. The old hand-rolled `status === 302` check missed the `location`
		// property and only worked by luck.
		if (isRedirect(error)) {
			throw error;
		}

		console.error('[issues/[date]/+page.server.ts] Error loading issue page:', error);
		return emptyState;
	}
};

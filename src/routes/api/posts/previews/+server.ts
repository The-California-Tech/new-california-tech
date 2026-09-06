import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { symbiont } from '$lib/symbiont';
import { fetchFeedPage, FEED_BATCH_SIZE } from '$lib/utils/feed-query';
import { parsePositiveInt } from '$lib/utils/post-pagination';

export const config = {
	maxage: 300, // Cache for 5 minutes
	revalidate: 300
};

export const GET: RequestHandler = async ({ fetch, url }) => {
	try {
		const query = (url.searchParams.get('q') || '').toLowerCase();
		const tag = url.searchParams.get('tag') || '';
		// Only issues on or before this Pacific date. Used by /issues/[date],
		// which is "the feed, starting at issue X and going back".
		const beforeDate = url.searchParams.get('beforeDate') || '';
		// Issue cursor, not a row offset. See feed-query.ts.
		const issueOffset = Math.max(0, parsePositiveInt(url.searchParams.get('issueOffset'), 0));
		const batchSize = parsePositiveInt(url.searchParams.get('limit'), FEED_BATCH_SIZE);

		const page = await fetchFeedPage(symbiont.getSSRClient(fetch), {
			query,
			tag,
			beforeDate,
			issueOffset,
			targetCount: batchSize
		});

		// Return only essential fields for filtering and display
		const previews = page.posts.map((post) => ({
			slug: post.slug,
			title: post.title,
			summary: post.summary?.slice(0, 150),
			summary_html: post.summary_html,
			showPreviewSummary: post.showPreviewSummary,
			previewLayout: post.previewLayout,
			layoutWeight: post.layoutWeight,
			authors: post.authors,
			tags: post.tags,
			published: post.published,
			cover: post.cover,
			coverWidth: post.coverWidth,
			coverHeight: post.coverHeight,
			thumbnail: post.thumbnail,
			coverStyle: post.coverStyle
		}));

		return json({
			posts: previews,
			issueOffset,
			nextIssueOffset: page.issueRank,
			hasMore: page.hasMore,
			totalCount: page.totalPosts,
			beforeDate: beforeDate || null
		});
	} catch (error) {
		console.error('[/api/posts/previews] Error fetching previews:', error);
		return json({ error: 'Failed to fetch previews' }, { status: 500 });
	}
};

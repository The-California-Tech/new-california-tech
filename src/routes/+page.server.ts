import type { PageServerLoad } from './$types';
import { symbiont } from '$lib/symbiont';
import { fetchFeedPage, FEED_BATCH_SIZE } from '$lib/utils/feed-query';
import { parsePositiveInt } from '$lib/utils/post-pagination';

// ISR config - enable SvelteKit's ISR caching
export const config = {
  maxage: 60,
  revalidate: 60,
};

export const prerender = false;

export const load: PageServerLoad = async ({ fetch, url, cookies }) => {
  const theme = cookies.get('theme') || 'light';

  try {
    const query = url.searchParams.get('q')?.toLowerCase() || '';
    const tag = url.searchParams.get('tag') || '';

    // `count` drives the no-JS "Load more" fallback, which navigates to
    // /?count=60, /?count=90 ... Each request re-renders the feed from the top
    // with a larger target. The JS path instead pages by issue cursor against
    // /api/posts/previews.
    const requestedCount = parsePositiveInt(url.searchParams.get('count'), FEED_BATCH_SIZE);

    const page = await fetchFeedPage(symbiont.getSSRClient(fetch), {
      query,
      tag,
      targetCount: requestedCount,
    });

    return {
      posts: page.posts,
      query,
      tag,
      hasMore: page.hasMore,
      shownCount: page.posts.length,
      /** Cursor for the JS path: whole issues already rendered. */
      issueCursor: page.issueRank,
      /** Absolute target for the next no-JS page, not a remainder. */
      nextCount: page.posts.length + FEED_BATCH_SIZE,
      batchSize: FEED_BATCH_SIZE,
      totalCount: page.totalPosts,
      theme,
    };
  } catch (error) {
    console.error('[+page.server.ts] Error loading page data:', error);
    return {
      posts: [],
      query: '',
      tag: '',
      hasMore: false,
      shownCount: 0,
      issueCursor: 0,
      nextCount: FEED_BATCH_SIZE,
      batchSize: FEED_BATCH_SIZE,
      totalCount: 0,
      theme,
    };
  }
};

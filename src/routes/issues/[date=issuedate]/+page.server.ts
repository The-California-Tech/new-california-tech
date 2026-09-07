import { redirect, isRedirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { symbiont } from '$lib/symbiont';
import { fetchIssuePosts } from '$lib/utils/feed-query';
import { buildIssueCards, formatIssueLabel, resolveIssue } from '$lib/utils/issues';

export const config = {
  maxage: 60,
  revalidate: 60,
};

export const prerender = false;

/**
 * A single issue of the paper. Bounded on purpose.
 *
 * This route used to call fetchFeedPage({ beforeDate }), which returns the
 * named issue *and every older issue*, then infinite-scrolled further back
 * while a scroll listener rewrote the address bar to whichever issue happened
 * to be under the viewport. The URL named one issue and the page showed the
 * archive from that point on, which is why it needed the rewriting at all --
 * and why `/`, /issues/2026-09-04 and /issues/2026-08-28 all served heavily
 * overlapping content with no canonical signal.
 *
 * Now it shows exactly one issue, with deliberate prev/next navigation.
 * Endless scroll-back still lives on `/`, where the URL does not claim to be
 * about any particular date.
 */
export const load: PageServerLoad = async ({ fetch, params, url, cookies }) => {
  const theme = cookies.get('theme') || 'light';
  const requestedIssueDate = params.date;

  const emptyState = {
    posts: [],
    query: '',
    tag: '',
    issueDate: requestedIssueDate,
    issueLabel: formatIssueLabel(requestedIssueDate),
    hasPdf: false,
    cover: undefined as string | undefined,
    older: null,
    newer: null,
    position: 0,
    total: 0,
    /** True when the filter matched nothing *in this issue*. */
    filteredEmpty: false,
    theme,
  };

  try {
    const query = url.searchParams.get('q')?.toLowerCase() || '';
    const tag = url.searchParams.get('tag') || '';

    // The union of website-inferred and archive-PDF issues. Resolving against
    // this rather than the nearest_issue_date RPC is what makes PDF-only
    // archive issues reachable -- see resolveIssue() for the full story.
    const issues = await buildIssueCards(fetch);
    const resolved = resolveIssue(issues, requestedIssueDate);

    if (!resolved.current) {
      return { ...emptyState, query, tag };
    }

    if (resolved.current.date !== requestedIssueDate) {
      const redirectTarget = new URL(`/issues/${resolved.current.date}`, url.origin);
      redirectTarget.search = url.search;
      redirect(302, `${redirectTarget.pathname}${redirectTarget.search}`);
    }

    const issueDate = resolved.current.date;

    // A PDF-only issue has no website articles at all, so skip the query
    // entirely rather than asking for an issue that cannot come back.
    const issue = resolved.current.hasWebsite
      ? await fetchIssuePosts(symbiont.getSSRClient(fetch), { issueDate, query, tag })
      : { posts: [], issueDate: null, totalIssues: 0, totalPosts: 0 };

    // Under a filter, list_homepage_posts falls through to the next older issue
    // that has a match. That would silently show the wrong issue's articles, so
    // treat a mismatch as "nothing here matches" instead.
    const isThisIssue = issue.issueDate === issueDate;
    const posts = isThisIssue ? issue.posts : [];

    return {
      posts,
      query,
      tag,
      issueDate,
      issueLabel: resolved.current.label || formatIssueLabel(issueDate),
      hasPdf: resolved.current.hasPdf,
      cover: resolved.current.cover,
      older: resolved.older,
      newer: resolved.newer,
      position: resolved.position,
      total: resolved.total,
      filteredEmpty: Boolean((query || tag) && resolved.current.hasWebsite && posts.length === 0),
      theme,
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

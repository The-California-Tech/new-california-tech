import type { RequestHandler } from './$types';
import { parsePositiveInt } from '#lib/utils/post-pagination.ts';
import { buildIssueCards } from '#lib/utils/issues.ts';

const ISSUE_PAGE_BATCH_SIZE = 24;

export const GET: RequestHandler = async ({ fetch, url }) => {
  try {
    const offset = Math.max(0, parsePositiveInt(url.searchParams.get('offset'), 0));
    const limit = parsePositiveInt(url.searchParams.get('limit'), ISSUE_PAGE_BATCH_SIZE);
    const issues = await buildIssueCards(fetch);
    const end = Math.min(offset + limit, issues.length);
    const page = issues.slice(offset, end);

    return Response.json({
      issues: page,
      offset,
      nextOffset: end,
      hasMore: end < issues.length,
      totalCount: issues.length,
    });
  } catch (error) {
    console.error('[/api/issues/cards] Error fetching issues cards:', error);
    return Response.json({ error: 'Failed to fetch issues cards' }, { status: 500 });
  }
};

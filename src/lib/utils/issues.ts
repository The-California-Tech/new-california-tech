import { symbiont } from '$lib/symbiont';
import { symbiontToTechArticle } from '$lib/utils/post-converter';
import { compareStringDesc, getPacificDateKey, sortByPublishDayThenLayoutWeightDesc } from '$lib/utils/post-sorting';
import type { Issue } from '$lib/types/index';
import { getAppThumbnailUrl, getIssueCoverThumbnailUrl } from './image-url';

export const FETCH_BATCH_SIZE = 1000;
export const WEBSITE_ALIAS = 'tech-article-staging';
export const ARCHIVE_ALIAS = 'tech-archives';
const MIN_WEBSITE_ARTICLES_PER_ISSUE = 2;

export function normalizeIssueDateFromSlug(rawSlug: string): string {
  const normalized = rawSlug.trim().replace(/^\/+|\/+$/g, '');
  const match = normalized.match(/\d{4}-\d{2}-\d{2}/);
  return match?.[0] ?? '';
}

export function formatIssueLabel(issueDate: string): string {
  const parsed = new Date(`${issueDate}T12:00:00-08:00`);
  if (Number.isNaN(parsed.getTime())) {
    return issueDate;
  }

  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Los_Angeles',
  });
}

function getStoredIssueCover(page: { cover?: unknown; meta?: Record<string, unknown> | null }): string | undefined {
  if (typeof page.cover === 'string' && page.cover) {
    return page.cover;
  }

  const metadata = page.meta;
  if (metadata && typeof metadata.cover === 'string' && metadata.cover) {
    return metadata.cover;
  }

  return undefined;
}

function indexWebsiteIssuesByDate(
  websitePosts: Awaited<ReturnType<typeof symbiontToTechArticle>>[],
): Map<string, { articleCount: number }> {
  const issueMap = new Map<string, { articleCount: number }>();
  for (const post of websitePosts) {
    const issueDate = getPacificDateKey(post.published);
    if (!issueDate) continue;

    const existing = issueMap.get(issueDate);
    if (existing) {
      existing.articleCount += 1;
      continue;
    }

    issueMap.set(issueDate, { articleCount: 1 });
  }
  return issueMap;
}

function indexArchiveIssuesByDate(
  archivePosts: Awaited<ReturnType<typeof symbiont.getAllPages>>,
): Map<string, { title: string; cover?: string; hasPdf: boolean }> {
  const issueMap = new Map<string, { title: string; cover?: string; hasPdf: boolean }>();

  for (const post of archivePosts) {
    const issueDate = normalizeIssueDateFromSlug(String(post.slug ?? ''));
    if (!issueDate || issueMap.has(issueDate)) continue;

    const metadata = post.meta && typeof post.meta === 'object' ? (post.meta as Record<string, unknown>) : {};
    const resolverUrl = typeof metadata.resolver_url === 'string' ? metadata.resolver_url : undefined;

    issueMap.set(issueDate, {
      title: post.title ?? `Issue ${issueDate}`,
      cover: getStoredIssueCover({ cover: post.cover, meta: metadata }),
      hasPdf: Boolean(resolverUrl?.endsWith('.pdf')),
    });
  }

  return issueMap;
}

export async function fetchAllPagesByAlias(
  fetchFn: typeof fetch,
  alias: string,
): Promise<Awaited<ReturnType<typeof symbiont.getAllPages>>> {
  const allPages: Awaited<ReturnType<typeof symbiont.getAllPages>> = [];
  let offset = 0;

  while (true) {
    const batch = await symbiont.getAllPages({
      fetch: fetchFn,
      alias,
      limit: FETCH_BATCH_SIZE,
      offset,
    });

    if (batch.length === 0) {
      break;
    }

    allPages.push(...batch);

    if (batch.length < FETCH_BATCH_SIZE) {
      break;
    }

    offset += FETCH_BATCH_SIZE;
  }

  return allPages;
}

export interface ResolvedIssue {
  /** The issue asked for, snapped to a real one. Null when there are none. */
  current: Issue.Card | null;
  /** The next *older* issue, or null at the end of the archive. */
  older: Issue.Card | null;
  /** The next *newer* issue, or null on the most recent issue. */
  newer: Issue.Card | null;
  /** 1-based position, newest first. Useful for "Issue 4 of 312". */
  position: number;
  total: number;
}

/**
 * Snap a requested date onto a real issue and find its neighbours.
 *
 * This replaces the `nearest_issue_date` RPC for /issues/[date], and the reason
 * is a correctness bug rather than a preference: that function selects from
 * `tech-article-staging` only, but an "issue" here is the *union* of website
 * issues (a Pacific date carrying at least MIN_WEBSITE_ARTICLES_PER_ISSUE
 * articles) and archive PDF issues from `tech-archives`. A PDF-only historical
 * issue therefore had no match, got snapped to some unrelated website issue,
 * and 302'd away -- so every PDF-only issue in the archive was unreachable at
 * its own URL even though /issues/<date>.pdf served the file happily.
 *
 * Resolving against the same union the /issues index is built from means the
 * two can no longer disagree about what exists.
 *
 * Ties break toward the more recent issue, matching the old SQL's behaviour.
 * `issues` must be sorted newest-first, as buildIssueCards returns it.
 */
export function resolveIssue(issues: Issue.Card[], requestedDate: string): ResolvedIssue {
  const empty: ResolvedIssue = { current: null, older: null, newer: null, position: 0, total: issues.length };
  if (issues.length === 0) return empty;

  const requested = normalizeIssueDateFromSlug(requestedDate);
  let index = issues.findIndex((issue) => issue.date === requested);

  if (index === -1) {
    const target = Date.parse(`${requested}T12:00:00-08:00`);
    if (Number.isNaN(target))
      return { ...empty, current: issues[0] ?? null, newer: null, older: issues[1] ?? null, position: 1 };

    let bestDistance = Number.POSITIVE_INFINITY;
    index = 0;
    issues.forEach((issue, candidate) => {
      const distance = Math.abs(Date.parse(`${issue.date}T12:00:00-08:00`) - target);
      // Strict `<` keeps the earlier (newer) candidate on a tie, since the
      // list is sorted newest-first.
      if (distance < bestDistance) {
        bestDistance = distance;
        index = candidate;
      }
    });
  }

  return {
    current: issues[index] ?? null,
    newer: index > 0 ? (issues[index - 1] ?? null) : null,
    older: issues[index + 1] ?? null,
    position: index + 1,
    total: issues.length,
  };
}

export async function buildIssueCards(fetchFn: typeof fetch): Promise<Issue.Card[]> {
  const [websitePosts, archivePosts] = await Promise.all([
    fetchAllPagesByAlias(fetchFn, WEBSITE_ALIAS),
    fetchAllPagesByAlias(fetchFn, ARCHIVE_ALIAS),
  ]);

  const websiteByDate = indexWebsiteIssuesByDate(
    websitePosts.map((post) => symbiontToTechArticle(post)).sort(sortByPublishDayThenLayoutWeightDesc),
  );
  const archiveByDate = indexArchiveIssuesByDate(archivePosts);
  const inferredWebsiteIssueDates = Array.from(websiteByDate.entries())
    .filter(([, details]) => details.articleCount >= MIN_WEBSITE_ARTICLES_PER_ISSUE)
    .map(([issueDate]) => issueDate);

  const allIssueDates = Array.from(new Set([...inferredWebsiteIssueDates, ...archiveByDate.keys()])).sort(
    compareStringDesc,
  );

  return allIssueDates.map((issueDate) => {
    const websiteIssue = websiteByDate.get(issueDate);
    const archiveIssue = archiveByDate.get(issueDate);

    return {
      date: issueDate,
      label: formatIssueLabel(issueDate),
      cover: getIssueCoverThumbnailUrl(archiveIssue?.cover),
      hasWebsite: Boolean(websiteIssue),
      hasPdf: Boolean(archiveIssue?.hasPdf),
    };
  });
}

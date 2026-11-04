import { compareStringDesc, getPacificDateKey } from '#lib/utils/post-sorting.ts';
import type { Issue } from '#lib/types/index.d.ts';
import { appDb, type AppDb } from '#lib/utils/app-db.ts';
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

/**
 * Which of these posts' issue dates (YYYY-MM-DD, Pacific -- the same key the
 * feed groups its date dividers by) have a print PDF at /issues/<date>.pdf.
 *
 * Looks up only the dates asked about: tech-archives has ~2000 rows, too many
 * to pull on every homepage load. Same test as the issue cards' `hasPdf`: an
 * archive row whose resolver_url is a .pdf, since that is what the .pdf route
 * streams. Fails open to "no PDFs", which only hides a link.
 */
export async function fetchPdfIssueDates(db: AppDb, posts: { published?: string }[]): Promise<string[]> {
  const dates = [...new Set(posts.map((post) => getPacificDateKey(post.published)).filter(Boolean))];
  if (dates.length === 0) return [];

  const { data, error } = await db
    .from('pages')
    .select('slug, resolver_url:meta->>resolver_url')
    .eq('datasource_alias', ARCHIVE_ALIAS)
    .in('slug', dates);
  if (error) {
    console.error('[issues] pdf lookup failed:', error.message);
    return [];
  }
  return (data ?? [])
    .filter((row) => typeof row.resolver_url === 'string' && row.resolver_url.endsWith('.pdf'))
    .map((row) => normalizeIssueDateFromSlug(String(row.slug ?? '')))
    .filter(Boolean);
}

/**
 * The issue date (YYYY-MM-DD, Pacific) of an article published at
 * `published`, if /issues/<that date> is a real issue page; otherwise null.
 *
 * "Real" by the same test buildIssueCards uses -- an archive row for the
 * date, or at least MIN_WEBSITE_ARTICLES_PER_ISSUE published articles on it
 * -- because /issues/<date> for any other date redirects to the NEAREST
 * issue, which is not where a link on this article's date should go. Asks
 * only about the one date: building every issue card costs every row.
 *
 * Fails closed to null, which only drops a link.
 */
export async function issuePageDate(db: AppDb, published?: string): Promise<string | null> {
  const date = getPacificDateKey(published);
  if (!date) return null;

  const { count: archived, error: archiveError } = await db
    .from('pages')
    .select('slug', { count: 'exact', head: true })
    .eq('datasource_alias', ARCHIVE_ALIAS)
    .like('slug', `%${date}%`);
  if (archiveError) return null;
  if (archived) return date;

  // A Pacific day falls inside this UTC window whatever the offset; the exact
  // day is then checked per row, the same way the issue cards group them.
  const from = new Date(`${date}T00:00:00Z`);
  from.setUTCDate(from.getUTCDate() - 1);
  const to = new Date(`${date}T00:00:00Z`);
  to.setUTCDate(to.getUTCDate() + 2);
  const { data, error } = await db
    .from('pages')
    .select('publish_at')
    .eq('datasource_alias', WEBSITE_ALIAS)
    .gte('publish_at', from.toISOString())
    .lt('publish_at', to.toISOString());
  if (error) return null;
  const sameDay = (data ?? []).filter((row) => getPacificDateKey(row.publish_at ?? undefined) === date).length;
  return sameDay >= MIN_WEBSITE_ARTICLES_PER_ISSUE ? date : null;
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

function indexWebsiteIssuesByDate(publishDates: (string | null)[]): Map<string, { articleCount: number }> {
  const issueMap = new Map<string, { articleCount: number }>();
  for (const published of publishDates) {
    const issueDate = getPacificDateKey(published ?? undefined);
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

/** The archive columns the issue cards use -- and only those. */
interface ArchiveIssueRow {
  slug: string | null;
  title: string | null;
  cover: string | null;
  meta_cover: string | null;
  resolver_url: string | null;
}

function indexArchiveIssuesByDate(
  archiveRows: ArchiveIssueRow[],
): Map<string, { title: string; cover?: string; hasPdf: boolean }> {
  const issueMap = new Map<string, { title: string; cover?: string; hasPdf: boolean }>();

  for (const row of archiveRows) {
    const issueDate = normalizeIssueDateFromSlug(String(row.slug ?? ''));
    if (!issueDate || issueMap.has(issueDate)) continue;

    issueMap.set(issueDate, {
      title: row.title ?? `Issue ${issueDate}`,
      cover: getStoredIssueCover({ cover: row.cover, meta: { cover: row.meta_cover } }),
      hasPdf: Boolean(row.resolver_url?.endsWith('.pdf')),
    });
  }

  return issueMap;
}

/**
 * Every public row of one datasource, but only the named columns.
 *
 * This used to go through symbiont.getAllPages, which selects `*`: every
 * article's full text, ~2000 archive rows' metadata, on every issue page and
 * every sitemap request. When the site went live a crawler walked the
 * /issues/<date> pages, and that load took the database down (PostgREST:
 * "Could not query the database for the schema cache"). The issue list needs a
 * date and a few short fields per row; ask for nothing more.
 *
 * Paged in FETCH_BATCH_SIZE rows, the most PostgREST returns at once.
 */
async function fetchAllRows<T>(fetchFn: typeof fetch, alias: string, columns: string): Promise<T[]> {
  const db = appDb(fetchFn);
  const rows: T[] = [];
  for (let offset = 0; ; offset += FETCH_BATCH_SIZE) {
    const { data, error } = await db
      .from('pages')
      .select(columns)
      .eq('datasource_alias', alias)
      .order('page_id')
      .range(offset, offset + FETCH_BATCH_SIZE - 1);
    if (error) throw new Error(`Query error: ${error.message}`);
    const batch = (data ?? []) as unknown as T[];
    rows.push(...batch);
    if (batch.length < FETCH_BATCH_SIZE) return rows;
  }
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

/**
 * How long a warm server instance reuses the issue list. Every /issues/<date>
 * page needs the whole list (to resolve the date and find its neighbours), and
 * a crawler visits each of ~2000 of them once -- each a different URL, so the
 * CDN cache never helps. Without this, every one of those requests rebuilt the
 * list from the database. A new issue appears within this long; the list
 * changes a few times a week.
 */
const ISSUE_CARDS_TTL_MS = 5 * 60 * 1000;
let issueCardsCache: { at: number; cards: Promise<Issue.Card[]> } | null = null;

/** The issue list, shared for ISSUE_CARDS_TTL_MS per instance. Failures are not kept. */
export function buildIssueCards(fetchFn: typeof fetch): Promise<Issue.Card[]> {
  const now = Date.now();
  if (issueCardsCache && now - issueCardsCache.at < ISSUE_CARDS_TTL_MS) return issueCardsCache.cards;
  const cards = loadIssueCards(fetchFn);
  const entry = { at: now, cards };
  issueCardsCache = entry;
  cards.catch(() => {
    if (issueCardsCache === entry) issueCardsCache = null;
  });
  return cards;
}

async function loadIssueCards(fetchFn: typeof fetch): Promise<Issue.Card[]> {
  const [websiteRows, archiveRows] = await Promise.all([
    fetchAllRows<{ publish_at: string | null }>(fetchFn, WEBSITE_ALIAS, 'publish_at'),
    fetchAllRows<ArchiveIssueRow>(
      fetchFn,
      ARCHIVE_ALIAS,
      'slug, title, cover, meta_cover:meta->>cover, resolver_url:meta->>resolver_url',
    ),
  ]);

  const websiteByDate = indexWebsiteIssuesByDate(websiteRows.map((row) => row.publish_at));
  const archiveByDate = indexArchiveIssuesByDate(archiveRows);
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

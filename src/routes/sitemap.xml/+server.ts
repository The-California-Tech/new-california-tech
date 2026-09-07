import type { RequestHandler } from '@sveltejs/kit';
import { symbiont } from '$lib/symbiont';
import { buildIssueCards } from '$lib/utils/issues';
import {
  ARTICLE_ALIAS,
  SITE_PAGE_ALIAS,
  SYNDICATION_CACHE_CONTROL,
  absoluteUrl,
  escapeXml,
  fetchAllPages,
  pageUrl,
  rfc3339,
} from '$lib/utils/syndication';

export const prerender = false;

type Entry = { loc: string; lastmod?: string | null; changefreq: string; priority: string };

/**
 * Static routes. /issues and /categories are real landing pages and are the
 * crawl entry points into the archive, so they carry higher priority than an
 * individual page.
 */
const STATIC_ROUTES: Entry[] = [
  { loc: absoluteUrl(''), changefreq: 'daily', priority: '1.0' },
  { loc: absoluteUrl('issues'), changefreq: 'weekly', priority: '0.8' },
  { loc: absoluteUrl('categories'), changefreq: 'weekly', priority: '0.5' },
];

/**
 * Everything the paper wants indexed.
 *
 * WHAT THIS USED TO MISS, AND WHY IT MATTERED
 *   The previous version emitted the homepage plus `getAllPages()` with its
 *   default limit of 100 -- so it advertised the 100 most recent articles and
 *   nothing else. Absent entirely: the whole issue archive, every static page,
 *   /issues, /categories, and every article past the hundredth. For a site
 *   meant to inherit tech.caltech.edu's search presence, that is most of the
 *   paper missing from the index.
 *
 * Issue pages are included now that /issues/[date] is bounded to a single
 * issue. While it was the homepage feed with a starting cursor, every issue URL
 * was a near-duplicate of `/` and listing them would have invited Google to
 * pick its own canonical among them.
 */
const render = async (fetch: typeof globalThis.fetch): Promise<string> => {
  const [articles, sitePages, issues] = await Promise.all([
    fetchAllPages(symbiont, { fetch, alias: ARTICLE_ALIAS }).catch((error) => {
      console.error('[sitemap.xml] articles failed:', error);
      return [];
    }),
    fetchAllPages(symbiont, { fetch, alias: SITE_PAGE_ALIAS }).catch((error) => {
      console.error('[sitemap.xml] site pages failed:', error);
      return [];
    }),
    buildIssueCards(fetch).catch((error) => {
      console.error('[sitemap.xml] issues failed:', error);
      return [];
    }),
  ]);

  const entries: Entry[] = [...STATIC_ROUTES];

  for (const article of articles) {
    const loc = pageUrl(article);
    if (!loc) continue; // null slug: the old code emitted literally "/undefined"
    entries.push({
      loc,
      lastmod: rfc3339(article.updated_at) ?? rfc3339(article.publish_at),
      changefreq: 'monthly',
      priority: '0.7',
    });
  }

  for (const sitePage of sitePages) {
    const loc = pageUrl(sitePage);
    if (!loc) continue;
    entries.push({
      loc,
      lastmod: rfc3339(sitePage.updated_at) ?? rfc3339(sitePage.publish_at),
      changefreq: 'monthly',
      priority: '0.6',
    });
  }

  for (const issue of issues) {
    entries.push({ loc: absoluteUrl(`issues/${issue.date}`), changefreq: 'yearly', priority: '0.6' });
    if (issue.hasPdf) {
      // Google does index PDFs. Lower priority than the HTML issue page so the
      // page that links it stays the stronger candidate for the same content.
      entries.push({ loc: absoluteUrl(`issues/${issue.date}.pdf`), changefreq: 'yearly', priority: '0.4' });
    }
  }

  // Belt and braces: a duplicate <loc> is a validation warning, and articles
  // and site pages share the /<slug> namespace so a collision is possible.
  const seen = new Set<string>();
  const unique = entries.filter((entry) => (seen.has(entry.loc) ? false : (seen.add(entry.loc), true)));

  const urls = unique
    .map(
      (entry) => `  <url>
    <loc>${escapeXml(entry.loc)}</loc>${entry.lastmod ? `\n    <lastmod>${entry.lastmod}</lastmod>` : ''}
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
};

export const GET: RequestHandler = async ({ fetch }) => {
  return new Response(await render(fetch), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': SYNDICATION_CACHE_CONTROL,
    },
  });
};

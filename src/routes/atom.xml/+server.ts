import type { RequestHandler } from '@sveltejs/kit';
import { siteConfig } from '$config/site';
import { symbiont } from '$lib/symbiont';
import {
  ARTICLE_ALIAS,
  FEED_ITEM_LIMIT,
  SYNDICATION_CACHE_CONTROL,
  absoluteUrl,
  authorNames,
  escapeXml,
  excerpt,
  pageUrl,
  rfc3339,
  type SyndicationPage,
} from '$lib/utils/syndication';

export const prerender = false;

const fetchPosts = async (fetch: typeof globalThis.fetch): Promise<SyndicationPage[]> => {
  try {
    // getAllPages orders by publish_at desc, so a plain limit is the most
    // recent N. RLS keeps future-dated articles out -- see syndication.ts.
    return (await symbiont.getAllPages({
      fetch,
      alias: ARTICLE_ALIAS,
      limit: FEED_ITEM_LIMIT,
    })) as SyndicationPage[];
  } catch (error) {
    console.error('[atom.xml] Error fetching posts:', error);
    return [];
  }
};

/**
 * Atom feed: excerpt plus a link back to the article.
 *
 * WHAT CHANGED AND WHY (Sep 2026)
 *   - Entries used to carry `<content type="html">` holding pages.content,
 *     which is *markdown*. Readers rendering it as HTML showed literal `##`
 *     and `[text](url)`. The feed now carries a plain-text excerpt and a link;
 *     the paper's full text is not syndicated.
 *   - `<summary>` was content.substring(0, 200) -- a hard slice of raw
 *     markdown. It now prefers the editor-written summary column.
 *   - CDATA was replaced with entity escaping. A literal `]]>` anywhere in an
 *     article silently terminated the section and produced a malformed feed.
 *   - `<category term="...">` interpolated tags straight into an XML
 *     attribute, so a tag containing & or " broke the document.
 *   - Tag links pointed at `?tags=`, but the app reads `?tag=` (singular, see
 *     tag.svelte), so every category link led to an unfiltered page.
 *   - Entries now credit the article's own authors instead of attributing
 *     every piece to the paper.
 *   - The feed-level <updated> was `new Date()`, so the feed reported itself
 *     as changed on every single request. It is now the newest article
 *     timestamp, which is both accurate and cacheable.
 */
const render = async (fetch: typeof globalThis.fetch): Promise<string> => {
  const posts = await fetchPosts(fetch);
  const siteAuthor = siteConfig.author?.name ?? siteConfig.title;
  const selfUrl = absoluteUrl('atom.xml');

  const entries = posts
    .map((post) => {
      const url = pageUrl(post);
      if (!url) return ''; // an article with no slug has nowhere to link

      const published = rfc3339(post.publish_at);
      const updated = rfc3339(post.updated_at) ?? published;
      const categories = (post.tags ?? [])
        .filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
        .map((tag) => {
          const scheme = absoluteUrl(`?tag=${encodeURIComponent(tag)}`);
          return `    <category term="${escapeXml(tag)}" scheme="${escapeXml(scheme)}" />`;
        })
        .join('\n');

      return `  <entry>
    <title type="text">${escapeXml(post.title ?? 'Untitled')}</title>
    <id>${escapeXml(url)}</id>
    <link rel="alternate" type="text/html" href="${escapeXml(url)}" />
${authorNames(post)
  .map((name) => `    <author><name>${escapeXml(name)}</name></author>`)
  .join('\n')}
${published ? `    <published>${published}</published>\n` : ''}    <updated>${updated ?? new Date().toISOString()}</updated>
    <summary type="text">${escapeXml(excerpt(post))}</summary>
${categories}
  </entry>`;
    })
    .filter(Boolean)
    .join('\n');

  // Newest article timestamp; falls back to the epoch-free "now" only when the
  // feed is empty, which keeps a populated feed byte-identical between hits.
  const latest =
    posts
      .map((post) => rfc3339(post.updated_at) ?? rfc3339(post.publish_at))
      .filter((value): value is string => Boolean(value))
      .sort()
      .pop() ?? new Date().toISOString();

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"${siteConfig.lang ? ` xml:lang="${escapeXml(siteConfig.lang)}"` : ''}>
  <id>${escapeXml(absoluteUrl(''))}</id>
  <title type="text">${escapeXml(siteConfig.title)}</title>
${siteConfig.subtitle ? `  <subtitle type="text">${escapeXml(siteConfig.subtitle)}</subtitle>\n` : ''}  <icon>${escapeXml(absoluteUrl('favicon.png'))}</icon>
  <link rel="alternate" type="text/html" href="${escapeXml(absoluteUrl(''))}" />
  <link rel="self" type="application/atom+xml" href="${escapeXml(selfUrl)}" />
  <updated>${latest}</updated>
  <author><name>${escapeXml(siteAuthor)}</name></author>
  <rights>Copyright ${new Date().getUTCFullYear()} ${escapeXml(siteConfig.title)}</rights>
${entries}
</feed>
`;
};

export const GET: RequestHandler = async ({ fetch }) => {
  return new Response(await render(fetch), {
    headers: {
      'Content-Type': 'application/atom+xml; charset=utf-8',
      'Cache-Control': SYNDICATION_CACHE_CONTROL,
    },
  });
};

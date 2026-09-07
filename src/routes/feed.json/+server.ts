import type { RequestHandler } from '@sveltejs/kit';
import { siteConfig } from '$config/site';
import { symbiont } from '$lib/symbiont';
import {
  ARTICLE_ALIAS,
  FEED_ITEM_LIMIT,
  SYNDICATION_CACHE_CONTROL,
  absoluteUrl,
  authorNames,
  excerpt,
  pageUrl,
  rfc3339,
  type SyndicationPage,
} from '$lib/utils/syndication';

export const prerender = false;

/**
 * JSON Feed 1.1: https://jsonfeed.org/version/1.1
 *
 * WHAT CHANGED AND WHY (Sep 2026)
 *   - `summary` was content.substring(0, 200) of raw markdown; it now prefers
 *     the editor-written summary column.
 *   - `content_html` was set to the markdown string, so any reader trusting
 *     the field rendered markup as literal text. The feed is excerpt-only now,
 *     carrying content_text (the spec requires one of the two) and no HTML.
 *   - `date_published` passed publish_at through verbatim. That is a Postgres
 *     timestamptz rendering ("2026-09-06 12:00:00+00"), which looks close
 *     enough to pass a glance but is not the RFC 3339 the spec requires.
 *   - `image` was hardcoded undefined; covers exist now and are included.
 *   - Items credit the article's authors rather than the paper.
 *   - The `slug.length > 0` filter's comment claimed to drop "unlisted posts",
 *     which it never did -- it dropped rows with no slug. Same effect, via
 *     pageUrl(), but no longer mislabelled.
 */
const buildItems = async (fetch: typeof globalThis.fetch) => {
  // No initialiser: the catch below returns, so every path that reaches the
  // mapping has assigned this. An `= []` would be dead code (eslint's
  // no-useless-assignment catches exactly that).
  let posts: SyndicationPage[];

  try {
    posts = (await symbiont.getAllPages({
      fetch,
      alias: ARTICLE_ALIAS,
      limit: FEED_ITEM_LIMIT,
    })) as SyndicationPage[];
  } catch (error) {
    console.error('[feed.json] Error fetching posts from database:', error);
    return [];
  }

  return posts
    .map((post) => {
      const url = pageUrl(post);
      if (!url) return null;

      const summary = excerpt(post);

      return {
        id: url, // a stable, globally unique id -- the bare slug was neither
        url,
        title: post.title ?? 'Untitled',
        summary,
        content_text: summary,
        image: post.cover || undefined,
        date_published: rfc3339(post.publish_at) ?? undefined,
        date_modified: rfc3339(post.updated_at) ?? rfc3339(post.publish_at) ?? undefined,
        authors: authorNames(post).map((name) => ({ name })),
        tags: (post.tags ?? []).filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0),
      };
    })
    .filter((item) => item !== null);
};

const render = async (fetch: typeof globalThis.fetch) => {
  const items = await buildItems(fetch);
  const author = siteConfig.author ?? { name: siteConfig.title };
  const favicon = absoluteUrl('favicon.png');

  return {
    version: 'https://jsonfeed.org/version/1.1',
    title: siteConfig.title,
    home_page_url: absoluteUrl(''),
    feed_url: absoluteUrl('feed.json'),
    description: siteConfig.description,
    // siteConfig.cover, not '/og-card.png': the card lives in user/assets and
    // is bundled by vite to a hashed path, so it is not served from the static
    // root. siteConfig.cover holds whatever that built path resolved to.
    icon: siteConfig.cover ? absoluteUrl(siteConfig.cover) : favicon,
    favicon,
    language: siteConfig.lang ?? 'en',
    authors: [{ name: author.name, url: absoluteUrl('') }],
    items,
  };
};

export const GET: RequestHandler = async ({ fetch }) =>
  new Response(JSON.stringify(await render(fetch), null, 2), {
    headers: {
      'Content-Type': 'application/feed+json; charset=utf-8',
      'Cache-Control': SYNDICATION_CACHE_CONTROL,
    },
  });

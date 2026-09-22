/**
 * Utility to convert Symbiont CMS posts to QWER post format
 */
import type { DatabasePage } from 'symbiont-cms';
import type { Post } from '$lib/types/post';
import { renderSummaryToHtml } from 'symbiont-cms/server';
import { getAppThumbnailUrl } from '$lib/utils/image-url';
import {
  autoCoverFit,
  autoCoverPlacement,
  DEFAULT_LAYOUT_PRESET,
  normalizeBylineFormat,
  normalizeCoverFit,
  normalizeCoverPlacement,
  normalizeLayoutPreset,
  normalizeProminence,
  resolveLayoutRecipe,
} from '$lib/utils/layout-preset';

/**
 * A row as consumed by the converter. Deliberately loose, because three
 * different shapes flow through here:
 *
 *  - `list_homepage_posts` RPC rows: have cover_width/cover_height/content_preview
 *    and issue_date/issue_rank, but no `content` (the function omits it).
 *  - `symbiont.getPageBySlug` (article pages): has full `content`, no cover_*.
 *  - `tech-archives` / website pages via issues.ts: plain DatabasePage.
 *
 * Everything cover- and preview-related is therefore optional. Making
 * cover_width/cover_height required was what broke the four call sites in
 * issues.ts, [slug], issues/[date] and categories.
 */
export interface TechPageRow extends Partial<DatabasePage> {
  cover_width?: number | null;
  cover_height?: number | null;
  /** left(content, 500) from list_homepage_posts(); backs the summary fallback. */
  content_preview?: string | null;
  issue_date?: string | null;
  issue_rank?: number | null;
}

/*
 * 'IN' -- the text-over-a-blurred-photo treatment -- is deliberately absent.
 * It was removed rather than merely unused, so setting it in Notion falls
 * through to the default instead of rendering a branch that no longer exists.
 * The enum member survives in post.d.ts; add the branch back to bring it back.
 */
const VALID_COVER_STYLES = new Set(['TOP', 'RIGHT', 'BOT', 'LEFT', 'NONE']);

/**
 * Trim source text to a word boundary before rendering it.
 *
 * This replaces `renderSummaryToHtml(previewSource).substring(0, 200)`, which
 * cut the *rendered HTML* at a fixed character count -- so it could slice
 * through a tag (`<e`) or an entity (`&amp` -> `&am`) and then hand the result
 * to {@html}. Truncating the source instead means the renderer always sees
 * complete input and always emits balanced markup.
 *
 * The limit is deliberately generous: how much of this is actually shown is a
 * layout decision now (the card's space budget), not a data one. This only
 * bounds the payload.
 */
function truncateAtWord(text: string, limit = 600): string {
  if (text.length <= limit) return text;

  const clipped = text.slice(0, limit);
  const lastSpace = clipped.lastIndexOf(' ');
  return (lastSpace > limit * 0.6 ? clipped.slice(0, lastSpace) : clipped).trimEnd() + '…';
}

function getMetadata(post: TechPageRow): Record<string, unknown> {
  const metadata = post.meta;
  return metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>) : {};
}

/**
 * The `Layout` preset. Reads the two property names this has had before it
 * (`layoutSize`, `webLayoutFormat`) so a part-migrated datasource still renders
 * -- normalizeLayoutPreset maps their old values onto the new vocabulary.
 */
function getLayoutPreset(metadata: Record<string, unknown>) {
  return (
    normalizeLayoutPreset(metadata.layoutPreset) ??
    normalizeLayoutPreset(metadata.layoutSize) ??
    normalizeLayoutPreset(metadata.webLayoutFormat) ??
    DEFAULT_LAYOUT_PRESET
  );
}

/**
 * How the cover image is treated -- independent of size.
 *
 * This used to fall back to the layout format, returning 'NONE' for anything
 * that was not `feature`. So every `standard` article lost its cover image
 * without anyone asking for that, and 'IN' was unreachable. The default is now
 * about the article itself: show the cover on top if there is one.
 */
function getCoverStyle(
  metadata: Record<string, unknown>,
  hasCover: boolean,
  presetWantsCover: boolean,
): Post.CoverStyle {
  const coverStyle = typeof metadata.coverStyle === 'string' ? metadata.coverStyle.toUpperCase() : null;
  if (coverStyle && VALID_COVER_STYLES.has(coverStyle)) {
    return coverStyle as Post.CoverStyle;
  }

  // The preset's answer is a default, not a derivation: an editor who sets
  // Cover Photo Style still wins. That distinction is what went wrong when the
  // layout format silently stripped covers off every `standard` article.
  return (hasCover && presetWantsCover ? 'TOP' : 'NONE') as Post.CoverStyle;
}

/**
 * The preset's answer, unless `Hide Summary` says otherwise.
 *
 * Note which way round that is. An earlier version had the *size* decide this
 * with no way to opt back in, so summaries vanished from articles whose size an
 * editor had changed for unrelated reasons and no property anywhere showed why.
 * A preset naming the whole card ("Brief") is allowed to carry a default; a
 * dimension of the card ("brief-sized") is not.
 */
function getShowPreviewSummary(metadata: Record<string, unknown>, presetWantsSummary: boolean): boolean {
  return typeof metadata.showPreviewSummary === 'boolean' ? metadata.showPreviewSummary : presetWantsSummary;
}

function toTechPublicSlug(post: TechPageRow): string {
  const rawSlug = String(post.slug ?? '').trim();
  const normalizedSlug = rawSlug.startsWith('/') ? rawSlug : `/${rawSlug}`;

  if (post.datasource_alias !== 'tech-archives') {
    return normalizedSlug;
  }

  if (normalizedSlug === '/issues' || normalizedSlug.startsWith('/issues/')) {
    return normalizedSlug;
  }

  const archiveSlug = normalizedSlug.startsWith('/') ? normalizedSlug.slice(1) : normalizedSlug;
  return `/issues/${archiveSlug}`;
}

export function symbiontToTechArticle(post: TechPageRow, html?: string, toc?: any[]): Post.Post {
  const metadata = getMetadata(post);
  const layoutPreset = getLayoutPreset(metadata);
  const recipe = resolveLayoutRecipe(layoutPreset);
  // Each dimension of the preset is separately overridable and normally is not
  // overridden. Same rule as Cover Photo Style and Hide Summary: the preset
  // supplies a default, an explicit property wins, and nothing is derived.
  const prominence = normalizeProminence(metadata.prominence) ?? recipe.prominence;
  const cover =
    typeof post.cover === 'string' && post.cover
      ? post.cover
      : typeof metadata.cover === 'string'
        ? metadata.cover
        : undefined;
  const coverCaption = typeof metadata.coverCaption === 'string' ? metadata.coverCaption : undefined;
  const coverWidth =
    typeof post.cover_width === 'number' && Number.isFinite(post.cover_width) ? post.cover_width : undefined;
  const coverHeight =
    typeof post.cover_height === 'number' && Number.isFinite(post.cover_height) ? post.cover_height : undefined;
  /*
   * Placement is the picture's business before it is the preset's: a portrait
   * wants a column of its own whatever the story's prominence says. The preset
   * only decides when the image gives no reason to differ -- and an explicit
   * Cover Placement still beats both.
   */
  const coverPlacement =
    normalizeCoverPlacement(metadata.coverPlacement) ??
    (autoCoverPlacement(coverWidth, coverHeight, prominence) === 'sidebar' ? 'sidebar' : recipe.coverPlacement);

  const thumbnail = getAppThumbnailUrl(cover);
  // Defaults to false: the cover already leads the card on the front page, and
  // repeating it full-width at the top of the article pushes the lede below the
  // fold for no new information. Set coverInPost on a page to opt back in.
  const coverInPost = typeof metadata.coverInPost === 'boolean' ? metadata.coverInPost : false;
  const layoutWeight =
    typeof metadata.layoutWeight === 'number' && Number.isFinite(metadata.layoutWeight)
      ? metadata.layoutWeight
      : undefined;
  const showPreviewSummary = getShowPreviewSummary(metadata, recipe.summary);
  const tags: Array<string> = Array.isArray(post.tags) ? post.tags : [];

  // list_homepage_posts() omits `content` (too large for a feed payload) and
  // exposes left(content, 500) as content_preview instead. Article pages still
  // get the full `content`. Prefer summary, then whichever body text we have.
  const previewSource = post.summary?.trim() || post.content_preview?.trim() || post.content?.trim() || '';

  return {
    // Direct pass-through fields
    slug: toTechPublicSlug(post),
    title: post.title ?? 'Untitled',
    content: post.content ?? '',
    summary: post.summary ?? '',
    // `description` feeds <meta name="description"> and og:description in
    // post_SEO.svelte. It used to come from WebsitePage.description, but that
    // type was removed from symbiont-cms, and DatabasePage has no equivalent.
    // Summary is the right source; leaving this '' emptied the meta tag on
    // every article page.
    description: post.summary?.trim() || '',
    cover,
    coverWidth,
    coverHeight,
    thumbnail,
    tags: tags.filter((tag) => !['web submission', 'Web Only'].includes(tag)),
    authors: Array.isArray(post.authors) ? post.authors : [],

    // Date field mapping
    published: post.publish_at ?? new Date().toISOString(),
    updated: post.updated_at ?? post.publish_at ?? new Date().toISOString(),
    created: post.publish_at ?? new Date().toISOString(),

    // Rendered content
    html: html ?? '',
    toc: toc as any,
    summary_html: post.summary?.trim()
      ? renderSummaryToHtml(post.summary)
      : previewSource
        ? renderSummaryToHtml(truncateAtWord(previewSource))
        : '',

    // QWER-specific UI fields (defaults)
    coverStyle: getCoverStyle(metadata, Boolean(cover), recipe.cover),
    showPreviewSummary,
    layoutPreset,
    prominence,
    coverPlacement,
    bylineFormat: normalizeBylineFormat(metadata.bylineFormat) ?? recipe.bylineFormat,
    // Derived from the image, not the layout -- so it is right by default for
    // every photo without anyone setting anything, and still overridable.
    coverFit: normalizeCoverFit(metadata.coverFit) ?? autoCoverFit(coverWidth, coverHeight),
    layoutWeight,
    coverInPost,
    coverCaption,
    options: [],
    series_tag: undefined,
    series_title: undefined,
    prev: undefined,
    next: undefined,
  };
}

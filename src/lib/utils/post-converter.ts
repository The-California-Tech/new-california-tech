/**
 * Utility to convert Symbiont CMS posts to QWER post format
 */
import type { DatabasePage } from 'symbiont-cms';
import type { Post } from '$lib/types/post';
import { renderSummaryToHtml } from 'symbiont-cms/server';
import { getAppThumbnailUrl } from '$lib/utils/image-url';

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

const VALID_COVER_STYLES = new Set(['TOP', 'RIGHT', 'BOT', 'LEFT', 'IN', 'NONE']);

function getMetadata(post: TechPageRow): Record<string, unknown> {
	const metadata = post.meta;
	return metadata && typeof metadata === 'object' ? metadata as Record<string, unknown> : {};
}

function getWebLayoutFormat(metadata: Record<string, unknown>): Post.PreviewLayoutFormat | null {
	const value = metadata.webLayoutFormat;
	if (typeof value !== 'string') {
		return null;
	}

	const normalized = value.trim().toLowerCase();
	if (normalized === 'compact' || normalized === 'standard' || normalized === 'feature') {
		return normalized as Post.PreviewLayoutFormat;
	}

	return null;
}

function getCoverStyle(metadata: Record<string, unknown>): Post.CoverStyle {
	const coverStyle = typeof metadata.coverStyle === 'string' ? metadata.coverStyle.toUpperCase() : null;
	if (coverStyle && VALID_COVER_STYLES.has(coverStyle)) {
		return coverStyle as Post.CoverStyle;
	}

	const webLayoutFormat = getWebLayoutFormat(metadata);
	if (webLayoutFormat === 'compact' || webLayoutFormat === 'standard') {
		return 'NONE' as Post.CoverStyle;
	}

	return 'TOP' as Post.CoverStyle;
}

function getShowPreviewSummary(metadata: Record<string, unknown>, webLayoutFormat: Post.PreviewLayoutFormat | null): boolean {
	if (typeof metadata.showPreviewSummary === 'boolean') {
		return metadata.showPreviewSummary;
	}

	if (webLayoutFormat === 'compact') {
		return false;
	}

	return true;
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

export function symbiontToTechArticle(
	post: TechPageRow,
	html?: string,
	toc?: any[]
): Post.Post {
	const metadata = getMetadata(post);
	const webLayoutFormat = getWebLayoutFormat(metadata);
	const cover = typeof post.cover === 'string' && post.cover
		? post.cover
		: typeof metadata.cover === 'string'
			? metadata.cover
			: undefined;
	const coverCaption = typeof metadata.coverCaption === 'string'
		? metadata.coverCaption
		: undefined;
	const coverWidth = typeof post.cover_width === 'number' && Number.isFinite(post.cover_width)
		? post.cover_width
		: undefined;
	const coverHeight = typeof post.cover_height === 'number' && Number.isFinite(post.cover_height)
		? post.cover_height
		: undefined;
	const thumbnail = getAppThumbnailUrl(cover);
	const coverInPost = typeof metadata.coverInPost === 'boolean'
		? metadata.coverInPost
		: true;
	const layoutWeight = typeof metadata.layoutWeight === 'number' && Number.isFinite(metadata.layoutWeight)
		? metadata.layoutWeight
		: undefined;
	const showPreviewSummary = getShowPreviewSummary(metadata, webLayoutFormat);
	const tags: Array<string> = Array.isArray(post.tags) ? post.tags : [];

	// list_homepage_posts() omits `content` (too large for a feed payload) and
	// exposes left(content, 500) as content_preview instead. Article pages still
	// get the full `content`. Prefer summary, then whichever body text we have.
	const previewSource = post.summary?.trim()
		|| post.content_preview?.trim()
		|| post.content?.trim()
		|| '';

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
				? renderSummaryToHtml(previewSource).substring(0, 200)
				: '',
		
		// QWER-specific UI fields (defaults)
		coverStyle: getCoverStyle(metadata),
		showPreviewSummary,
		previewLayout: webLayoutFormat ?? undefined,
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

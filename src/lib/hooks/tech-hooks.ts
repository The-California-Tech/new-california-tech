import type { Hook, HookContext } from 'symbiont-cms';
import {
  uploadFileToSupabase,
  uploadBufferToSupabase,
  getPropertyNamedValue,
  getPropertyNumberValue,
} from 'symbiont-cms/server';
import { parseTechIssueDate, parseWebsitePublishDate } from './utils/date-parser.js';
import { createHash } from 'crypto';

const WEB_LAYOUT_FORMAT_PROPERTY_NAME = 'Web Layout Format';
const LAYOUT_WEIGHT_PROPERTY_NAME = 'Layout Weight';

const HTML_FENCE_PATTERN = /(^|\n)```html[^\n]*\n([\s\S]*?)\n```(?=\n|$)/g;

function normalizeWebLayoutFormat(value: string | null): 'compact' | 'standard' | 'feature' | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'compact' || normalized === 'standard' || normalized === 'feature') {
    return normalized;
  }

  return null;
}

function expandHtmlCodeBlocks(content: string): string {
  return content.replace(HTML_FENCE_PATTERN, (match, prefix, html) => {
    const trimmedHtml = html.trim();
    if (!trimmedHtml) {
      return match;
    }

    return `${prefix}${trimmedHtml}\n\n`;
  });
}

function isPrintOnlyOrAdvertisement(ctx: HookContext): boolean {
  const tags = ctx.page.properties.Tags as any;
  return (
    tags?.multi_select?.some((tag: any) => {
      const name = String(tag?.name ?? '')
        .trim()
        .toLowerCase();
      return name === 'print only' || name === 'advertisement';
    }) ?? false
  );
}

function countWordsFromMarkdown(markdown: string): number {
  if (!markdown.trim()) {
    return 0;
  }

  const plainText = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[>#*_~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!plainText) {
    return 0;
  }

  return plainText.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

/**
 * Rendering resolution. PDFium's scale 1 is 72 DPI, which for a broadsheet page
 * is far too coarse to read a masthead; 2 gives 144 DPI and is then downscaled,
 * so the result is sharp without keeping a huge bitmap around.
 */
const THUMBNAIL_RENDER_SCALE = 2;

/** Long edge of the stored cover. Cards display at roughly 300-500 CSS px. */
const THUMBNAIL_MAX_WIDTH = 1000;

/**
 * Render the first page of a remote PDF as a PNG buffer.
 *
 * WHY PDFIUM RATHER THAN pdf-to-img/pdfjs
 *   pdf-to-img depends only on pdfjs-dist -- @napi-rs/canvas is not even an
 *   optional dependency of either -- so pdfjs reaches for it at runtime and the
 *   lambda dies with:
 *     Cannot load "@napi-rs/canvas" package
 *     Cannot polyfill `DOMMatrix`, rendering may be broken.
 *     Cannot polyfill `Path2D`, rendering may be broken.
 *   Installing it means shipping a platform-specific native binary and getting
 *   Vercel's file tracing to carry the right one into /var/task. PDFium is
 *   compiled to WebAssembly and ships inside the package, so there is no native
 *   module to resolve and nothing platform-specific to trace.
 *
 * WHY THE OLD THUMBNAILS HAD MANGLED TEXT BACKGROUNDS
 *   A PDF page has no background of its own -- "paper white" is implicit, and
 *   the renderer supplies it. pdfjs without its canvas polyfills rasterised
 *   onto transparency, so anything the page did not explicitly paint stayed
 *   alpha-0, and text drawn with knockout/transparency groups composited
 *   against nothing. PDFium renders onto opaque white unless you pass
 *   `transparent: true`, which is exactly what a page thumbnail wants.
 *
 * Also drops the base64 data-URL round trip the old code needed: that inflated
 * every PDF by ~33% in lambda memory before decoding it again, which is a real
 * cost for a full newspaper issue.
 */
export async function generateThumbnailBuffer(pdfUrl: string): Promise<Buffer> {
  // Imported lazily so SSR route loads never pay for instantiating the WASM
  // module -- only the sync path renders PDFs.
  const [{ PDFiumLibrary }, { default: sharp }] = await Promise.all([
    import('@hyzyla/pdfium'),
    import('sharp'),
  ]);

  const response = await fetch(pdfUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
  }
  const pdfBytes = new Uint8Array(await response.arrayBuffer());

  const library = await PDFiumLibrary.init();
  let document;
  try {
    document = await library.loadDocument(pdfBytes);

    if (document.getPageCount() < 1) {
      throw new Error('PDF has no pages');
    }

    // getPage is 0-indexed here; pdf-to-img's getPage was 1-indexed.
    const page = document.getPage(0);

    // `render` takes 'bitmap' or a callback -- the published package has no
    // 'sharp' shorthand, whatever the docs site shows. Doing the encode in the
    // callback keeps it to a single sharp pass: raw pixels in, PNG out.
    //
    // channels: 4 is correct and needs no channel swap. PDFium's native output
    // is BGRA, but this library sets FPDF_REVERSE_BYTE_ORDER for every non-Gray
    // colour space, so what reaches this callback is already RGBA.
    //
    // `transparent` is left at its default of false, which is the whole point
    // of the switch: PDFium fills the page white first, so nothing the PDF
    // leaves unpainted comes out as alpha-0.
    const rendered = await page.render({
      scale: THUMBNAIL_RENDER_SCALE,
      render: async ({ data, width, height }) =>
        sharp(Buffer.from(data), { raw: { width, height, channels: 4 } })
          .resize({ width: THUMBNAIL_MAX_WIDTH, withoutEnlargement: true })
          .png({ compressionLevel: 9 })
          .toBuffer(),
    });

    return Buffer.from(rendered.data);
  } finally {
    // PDFium holds its buffers in WASM linear memory, which the JS GC cannot
    // reclaim. Skipping these leaks the whole document for the life of the
    // lambda instance, and instances are reused across invocations.
    document?.destroy();
    library.destroy();
  }
}

/**
 * California Tech custom hooks for Symbiont CMS.
 *
 * These hooks customize page processing for the California Tech newspaper:
 * - Exclude Print Only and Advertisement articles from Supabase
 * - Only publish articles with Status = "Published"
 * - Parse dates from Issue property with PST timezone
 * - Extract custom slug from Website Slug property
 * - Sync derived metadata like Word Count back to Notion
 */

export const excludeAndDeletePrintOnlyHook: Hook<boolean> = {
  name: 'tech:exclude-and-delete:print-only',
  event: 'page:should-sync',
  priority: 'override',
  fn: async (ctx: HookContext) => {
    if (!isPrintOnlyOrAdvertisement(ctx)) {
      return true;
    }

    const supabase = ctx.services.supabase;
    if (supabase) {
      const { error } = await supabase
        .from('pages')
        .delete()
        .eq('page_id', ctx.page.id)
        .eq('datasource_id', ctx.config.dataSourceId);

      if (error) {
        ctx.logger.error({
          event: 'print_only_delete_failed',
          pageId: ctx.page.id,
          datasourceId: ctx.config.dataSourceId,
          error: error.message,
        });
      } else {
        ctx.logger.info({
          event: 'print_only_deleted_from_supabase',
          pageId: ctx.page.id,
          datasourceId: ctx.config.dataSourceId,
        });
      }
    }

    ctx.logger.info({
      event: 'page_excluded_from_sync',
      pageId: ctx.page.id,
      reason: 'Print Only or Advertisement tag',
    });

    return false;
  },
};

/**
 * The article's publish date, or null if it does not have a usable one.
 *
 * SHARED BY publish:check AND publish:date ON PURPOSE. Those two hooks used to
 * ask different questions -- check asked whether the property was *present*,
 * date asked whether it *parsed* -- and the gap between them silently re-dated
 * articles to today:
 *
 *   1. Issue is set to something that is not a parseable date (and there is no
 *      Website Publish Date).
 *   2. publish:check sees a truthy `issueProperty` and returns true.
 *   3. publish:date cannot parse it, finds no fallback, returns null.
 *   4. `publish:date` composes with FirstWins, so null abstains rather than
 *      meaning "definitively none" -- and symbiont's default hook then returns
 *      ctx.page.last_edited_time.
 *   5. For a page being edited right now, that is today.
 *
 * Worse, it is not a one-off: publish_at is rewritten on every sync, so such an
 * article keeps moving to whatever day it was last touched.
 *
 * Note that `priority: 'override'` does not prevent this. In the registry it is
 * an alias of 'before' (both map to weight 40), so it changes ordering only --
 * the default still runs when this returns null. The only reliable way to keep
 * the default from firing is to not be publishable in the first place, which is
 * what routing both hooks through this function achieves: an article without a
 * resolvable date fails publish:check, and page-transformer then skips
 * publish:date entirely, leaving publish_at null.
 */
export function resolveTechPublishDate(ctx: HookContext): string | null {
  const issueProperty = (ctx.page.properties.Issue as any)?.select?.name;
  if (issueProperty) {
    const parsed = parseTechIssueDate(issueProperty);
    if (parsed) return parsed;
  }

  const websiteDate = (ctx.page.properties['Website Publish Date'] as any)?.date?.start;
  if (websiteDate) {
    const parsed = parseWebsitePublishDate(websiteDate);
    if (parsed) return parsed;
  }

  return null;
}

/**
 * Check if page should be published based on Status property.
 * Only pages with Status = "Published" are public.
 * Print Only and Advertisement articles are excluded via page:should-sync.
 *
 * Uses publish:check event (AndAll strategy):
 * - Return false to prevent publishing (page syncs but publish_at is null)
 * - Return true to allow publishing
 * - Return null for no opinion
 */
export const publishCheckHook: Hook<boolean> = {
  name: 'tech:publish:check',
  event: 'publish:check',
  priority: 'override',
  fn: async (ctx: HookContext) => {
    const status = ctx.page.properties.Status as any;

    const isPublished = status?.status?.name === 'Published';
    const hasPrintOnlyTag = isPrintOnlyOrAdvertisement(ctx);

    // A *resolvable* date, not merely a present property -- see
    // resolveTechPublishDate for why the difference matters.
    const publishDate = resolveTechPublishDate(ctx);
    const shouldPublish = isPublished && !hasPrintOnlyTag && publishDate !== null;

    if (!shouldPublish) {
      const issueProperty = (ctx.page.properties.Issue as any)?.select?.name;
      const websiteDate = (ctx.page.properties['Website Publish Date'] as any)?.date?.start;

      // An article marked Published but held back only by an unusable date is
      // an editor-facing problem, not a routine skip: it looks published in
      // Notion and is invisible on the site. Log it loudly enough to find.
      if (isPublished && !hasPrintOnlyTag) {
        ctx.logger.warn({
          event: 'publish_blocked_unusable_date',
          pageId: ctx.page.id,
          issueProperty,
          websiteDate,
          reason: issueProperty || websiteDate ? 'date present but unparseable' : 'no date set',
        });
      } else {
        ctx.logger.debug({
          event: 'publish_check_failed',
          pageId: ctx.page.id,
          status: status?.status?.name,
          hasPrintOnlyTag,
        });
      }
    }

    return shouldPublish;
  },
};

export const wordCountSyncHook: Hook<void> = {
  name: 'tech:content:sync:word-count',
  event: 'content:sync',
  priority: 'after',
  continueOnError: true,
  fn: async (ctx: HookContext) => {
    const notionClient = ctx.services.notionClient;
    const content = ctx.output.content;

    if (!notionClient || typeof content !== 'string') {
      return null;
    }

    const wordCount = countWordsFromMarkdown(content);
    const wordCountProp = ctx.page.properties['Word Count'] as any;
    const existingWordCount =
      typeof wordCountProp?.number === 'number'
        ? String(wordCountProp.number)
        : (wordCountProp?.rich_text?.map((rt: any) => rt.plain_text).join('') ?? '').trim();
    const nextWordCount = String(wordCount);

    if (existingWordCount === nextWordCount) {
      ctx.logger.debug({
        event: 'word_count_sync_skipped_no_change',
        pageId: ctx.page.id,
        wordCount,
      });
      return null;
    }

    await notionClient.updateProperty(ctx.page.id, 'Word Count', nextWordCount);
    ctx.logger.debug({
      event: 'word_count_synced_to_notion',
      pageId: ctx.page.id,
      wordCount,
    });

    return null;
  },
};

export const articlePreviewMetadataHook: Hook<Record<string, unknown>> = {
  name: 'tech:metadata:preview-display',
  event: 'metadata:add',
  priority: 'override',
  fn: async (ctx: HookContext) => {
    const webLayoutFormat = normalizeWebLayoutFormat(
      getPropertyNamedValue(ctx.page.properties[WEB_LAYOUT_FORMAT_PROPERTY_NAME]),
    );
    const layoutWeight = getPropertyNumberValue(ctx.page.properties[LAYOUT_WEIGHT_PROPERTY_NAME]);

    const metadata: Record<string, unknown> = {};
    if (webLayoutFormat) {
      metadata.webLayoutFormat = webLayoutFormat;
      metadata.coverStyle = webLayoutFormat === 'feature' ? 'TOP' : 'NONE';
      metadata.showPreviewSummary = webLayoutFormat !== 'compact';
    }

    if (layoutWeight !== null) {
      metadata.layoutWeight = layoutWeight;
    }

    return Object.keys(metadata).length > 0 ? metadata : null;
  },
};

export const htmlCodeEmbedHook: Hook<string> = {
  name: 'tech:content:postprocess:html-embeds',
  event: 'content:postprocess',
  priority: 'after',
  fn: async (ctx: HookContext) => {
    const content = typeof ctx.input === 'string' ? ctx.input : '';
    if (!content.includes('```html')) {
      return null;
    }

    const expandedContent = expandHtmlCodeBlocks(content);
    return expandedContent === content ? null : expandedContent;
  },
};

/**
 * Parse publish date from Issue property or Website Publish Date.
 *
 * Priority order:
 * 1. Issue property (e.g., "January 20, 2023") - parsed with PST timezone
 * 2. Website Publish Date property
 * 3. Return null → falls through to default (last_edited_time)
 */
export const publishDateHook: Hook<string | Date> = {
  name: 'tech:publish:date:issue-based',
  event: 'publish:date',
  priority: 'override',
  fn: async (ctx: HookContext) => {
    const publishDate = resolveTechPublishDate(ctx);

    if (publishDate) {
      ctx.logger.debug({
        event: 'publish_date_resolved',
        pageId: ctx.page.id,
        date: publishDate,
      });
      return publishDate;
    }

    // Should be unreachable: page-transformer only runs publish:date when
    // publish:check passed, and publish:check now requires this same function
    // to return a date. If it ever fires, the two have drifted apart again --
    // and the consequence is silent, because returning null here hands the
    // decision to symbiont's default hook, which stamps last_edited_time.
    ctx.logger.error({
      event: 'publish_date_unresolved_after_check_passed',
      pageId: ctx.page.id,
      issueProperty: (ctx.page.properties.Issue as any)?.select?.name,
      websiteDate: (ctx.page.properties['Website Publish Date'] as any)?.date?.start,
      consequence: 'symbiont default will set publish_at to last_edited_time (today)',
    });
    return null;
  },
};

/**
 * Archive issue hooks for tech-archives database.
 * Handles date-based slugs and resolver URLs.
 */
export const archiveIssueHooks: Hook[] = [
  {
    name: 'archives:publish:check',
    event: 'publish:check',
    priority: 'override',
    fn: async () => {
      // Archive rows are intentionally public so issue cards can always read
      // their cover/PDF metadata from the public pages API.
      return true;
    },
  },
  {
    // Skip duplicate archive issues: if this date's slug already belongs to a
    // different Notion page, it's a duplicate entry — don't sync it.
    name: 'archives:dedup',
    event: 'page:should-sync',
    priority: 'override',
    fn: async (ctx: HookContext) => {
      const supabase = ctx.services.supabase;
      if (!supabase) return true;
      const dateStart = (ctx.page.properties.Date as any)?.date?.start;
      if (!dateStart) return true;
      const date = new Date(dateStart.trim());
      if (isNaN(date.getTime())) return true;
      const slug = date.toISOString().split('T')[0];
      const { data: existing } = await supabase
        .from('pages')
        .select('page_id')
        .eq('slug', slug)
        .eq('datasource_id', ctx.config.dataSourceId)
        .maybeSingle();
      if (existing && existing.page_id !== ctx.page.id) {
        ctx.logger.info({
          event: 'archive_duplicate_skipped',
          pageId: ctx.page.id,
          duplicateOfPageId: existing.page_id,
          slug,
        });
        return false;
      }
      return true;
    },
  },
  {
    name: 'archives:slug:date',
    event: 'slug:extract',
    priority: 'override',
    fn: async (ctx: HookContext) => {
      // Slug from date property (e.g. "2024-10-21")
      const dateStart = (ctx.page.properties.Date as any)?.date?.start;
      if (!dateStart) return null;
      const date = new Date(dateStart.trim());
      if (isNaN(date.getTime())) {
        ctx.logger.warn({
          event: 'archives_invalid_date_slug',
          pageId: ctx.page.id,
          dateStart,
        });
        return null;
      }
      return date.toISOString().split('T')[0];
    },
  },
  {
    name: 'archives:date',
    event: 'publish:date',
    priority: 'override',
    fn: async (ctx: HookContext) => {
      // Publish date directly from the ISO Date property value.
      // Don't use parseTechIssueDate here — that function is for human-readable
      // strings like "January 20, 2023" and breaks on full ISO datetimes.
      const dateStart = (ctx.page.properties.Date as any)?.date?.start;
      if (!dateStart) return null;
      const date = new Date(dateStart.trim());
      if (isNaN(date.getTime())) return null;
      // Emit at 07:00 PST (14:00 UTC) to match legacy behaviour
      const iso = date.toISOString().split('T')[0];
      return new Date(`${iso}T14:00:00.000Z`).toISOString();
    },
  },
  {
    name: 'archives:metadata:resolver',
    event: 'metadata:add' as Hook['event'],
    priority: 'override',
    fn: async (ctx: HookContext) => {
      // Prefer the URL uploaded this run (stashed by archives:pdf on page:before);
      // fall back to whatever URL is already on the Notion page snapshot.
      // On first sync the Notion property won't be set yet, so ctx.store is the
      // only reliable source.
      const resolverUrl =
        (ctx.store.pdfPublicUrl as string | undefined) ?? (ctx.page.properties['PDF URL'] as any)?.url;

      return {
        resolver_url: resolverUrl || null,
      };
    },
  },
  {
    name: 'archives:pdf',
    event: 'page:before',
    priority: 'override',
    fn: async (ctx: HookContext) => {
      // If page has a file in the `PDF` property, upload to Supabase and set `PDF URL` property with public URL
      const pdfFile = (ctx.page.properties.PDF as any)?.files?.[0];
      if (pdfFile) {
        const pdfUrl = pdfFile.type === 'external' ? pdfFile.external?.url : pdfFile.file?.url;
        if (pdfUrl && ctx.services.supabase) {
          // Build deterministic storage path from the issue date
          const dateStart = (ctx.page.properties.Date as any)?.date?.start;
          const isoDate = dateStart ? new Date(dateStart).toISOString().split('T')[0] : null;
          const storagePath = isoDate ? `issues/${isoDate}.pdf` : undefined;

          try {
            const uploadResult = await uploadFileToSupabase(pdfUrl, {
              supabase: ctx.services.supabase,

              contentType: 'application/pdf',
              storagePath,
            });
            // Stash public URL in store so cover:extract can read it
            // without requiring ctx.page to be re-fetched from Notion
            ctx.store.pdfPublicUrl = uploadResult.newUrl;
            ctx.logger.debug({
              event: 'uploaded_pdf_to_supabase',
              pageId: ctx.page.id,
              pdfUrl,
              publicUrl: uploadResult.newUrl,
            });
            // Write the Supabase public URL back to the Notion 'PDF URL' url property
            await ctx.services.notionClient.updateUrlProperty(ctx.page.id, 'PDF URL', uploadResult.newUrl);
          } catch (error) {
            ctx.logger.error({
              event: 'pdf_upload_failed',
              pageId: ctx.page.id,
              pdfUrl,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }
    },
  },
  {
    name: 'archives:cover',
    event: 'cover:extract',
    priority: 'override',
    fn: async (ctx: HookContext) => {
      // If this page already has a cover in the database, skip thumbnail generation.
      const supabase = ctx.services.supabase;
      if (supabase) {
        const { data: existingRow } = await supabase
          .from('pages')
          .select('cover')
          .eq('page_id', ctx.page.id)
          .maybeSingle();

        if (existingRow?.cover) {
          ctx.logger.debug({
            event: 'cover_already_exists_skipping',
            pageId: ctx.page.id,
            cover: existingRow.cover,
          });
          return existingRow.cover as string;
        }
      }

      // Prefer the URL stashed in store by archives:pdf this same run;
      // fall back to the PDF URL property already on the Notion page
      const pdfUrl: string | undefined =
        (ctx.store.pdfPublicUrl as string | undefined) ?? (ctx.page.properties['PDF URL'] as any)?.url;
      if (pdfUrl) {
        if (!supabase) {
          ctx.logger.error({
            event: 'supabase_client_unavailable',
            pageId: ctx.page.id,
            pdfUrl,
          });
          return null;
        }
        try {
          const thumbnailBuffer = await generateThumbnailBuffer(pdfUrl);
          // Derive a stable filename from a hash of the source PDF URL
          const hash = createHash('sha256').update(pdfUrl).digest('hex').substring(0, 12);
          const filename = `${hash}_cover.png`;
          ctx.logger.debug({
            event: 'generated_thumbnail_from_pdf',
            pageId: ctx.page.id,
            pdfUrl,
            filename,
          });
          try {
            const uploadResult = await uploadBufferToSupabase(thumbnailBuffer, {
              supabase,
              filename,
              contentType: 'image/png',
            });
            ctx.logger.debug({
              event: 'uploaded_thumbnail_to_supabase',
              pageId: ctx.page.id,
              pdfUrl,
              thumbnailUrl: uploadResult.newUrl,
            });
            return uploadResult.newUrl;
          } catch (uploadError) {
            ctx.logger.error({
              event: 'thumbnail_upload_failed',
              pageId: ctx.page.id,
              pdfUrl,
              error: uploadError instanceof Error ? uploadError.message : String(uploadError),
            });
          }
        } catch (error) {
          ctx.logger.error({
            event: 'thumbnail_generation_failed',
            pageId: ctx.page.id,
            pdfUrl,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return null;
    },
  },
];

/**
 * Website pages hooks for tech-website-pages database.
 * Handles static pages, redirects, and page status (Live/Draft/Not shown).
 */
export const websitePagesHooks: Hook[] = [
  htmlCodeEmbedHook,
  // Exclude "Draft" pages - don't sync at all, keeps previous live version
  {
    name: 'pages:exclude:draft',
    event: 'page:should-sync',
    priority: 'override',
    fn: async (ctx: HookContext) => {
      const status = (ctx.page.properties.Status as any)?.select?.name;
      const shouldExclude = status === 'Draft';

      if (shouldExclude) {
        ctx.logger.info({
          event: 'page_excluded',
          pageId: ctx.page.id,
          title: (ctx.page.properties.Title as any)?.title?.[0]?.plain_text,
          reason: 'Status is Draft - not syncing',
        });
        return false; // Don't sync
      }

      return true; // Allow sync
    },
  },

  // "Not shown" pages: sync to DB but set published_at to null
  // {
  // 	name: 'pages:publish:not-shown',
  // 	event: 'publish:check',
  // 	priority: 'override',
  // 	fn: async (ctx: HookContext) => {
  // 		const status = (ctx.page.properties.Status as any)?.select?.name;

  // 		if (status === 'Not shown') {
  // 			ctx.logger.info({
  // 				event: 'page_unpublished',
  // 				pageId: ctx.page.id,
  // 				title: (ctx.page.properties.Title as any)?.title?.[0]?.plain_text,
  // 				reason: 'Status is Not shown - setting published_at to null'
  // 			});
  // 			return false; // published_at will be null
  // 		}

  // 		// Live pages are published
  // 		return status === 'Live';
  // 	}
  // },

  // Validate that Redirect pages have either a redirect link or file
  // Note: page:validate event no longer exists, using page:before for validation warnings
  {
    name: 'pages:validate:redirects',
    event: 'page:before',
    priority: 'override',
    fn: async (ctx: HookContext) => {
      const type = (ctx.page.properties.Type as any)?.select?.name;

      if (type === 'Redirect') {
        const redirectLink = (ctx.page.properties['Redirect Link'] as any)?.url;
        const file = (ctx.page.properties.File as any)?.files?.[0];

        if (!redirectLink && !file) {
          ctx.logger.warn({
            event: 'validation_warning',
            pageId: ctx.page.id,
            title: (ctx.page.properties.Title as any)?.title?.[0]?.plain_text,
            issue: 'Redirect type page has no Redirect Link or File',
          });
        }
      }

      // page:before hooks are RunAll, no return value needed
    },
  },

  // Extract custom metadata: type, status, redirectLink, file
  {
    name: 'pages:metadata:page-type',
    event: 'metadata:add' as Hook['event'],
    priority: 'override',
    fn: async (ctx: HookContext) => {
      const type = (ctx.page.properties.Type as any)?.select?.name || 'Content';
      const status = (ctx.page.properties.Status as any)?.select?.name || 'Live';
      const redirectLink = (ctx.page.properties['Redirect Link'] as any)?.url;
      const file = (ctx.page.properties.File as any)?.files?.[0];

      return {
        pageType: type,
        pageStatus: status,
        ...(redirectLink && { redirectLink }),
        ...(file && {
          file: {
            name: file.name,
            url: file.type === 'external' ? file.external?.url : file.file?.url,
            type: file.type,
          },
        }),
      };
    },
  },
];

/**
 * Article hooks for tech-article-staging database.
 * Exported as default export for backwards compatibility.
 */
export const techHooks: Hook[] = [
  excludeAndDeletePrintOnlyHook,
  publishCheckHook,
  publishDateHook,
  articlePreviewMetadataHook,
  htmlCodeEmbedHook,
  wordCountSyncHook,
];

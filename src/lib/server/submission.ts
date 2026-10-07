/**
 * /submit's write path: one public form post becomes one article in
 * tech-article-staging, owned by the web editor, with an edit link for the
 * writer.
 *
 * Under `$lib/server` so SvelteKit refuses to bundle it for the browser -- it
 * holds the Notion token.
 *
 * WHERE THINGS LIVE
 *   The Notion page carries the properties editors work with (Status, Layout,
 *   Authors...) and Where is it = Web Editor. Its body is only a link to the
 *   web editor -- the same edit link the writer gets, also put in Info. The
 *   text lives in pages.content, which the web editor writes and the sync
 *   leaves alone (sync/hooks/content-source.ts). Moving Where is it to any
 *   other value hands the text to Notion and stops the link until it is moved
 *   back. Unpublished rows have publish_at null, so RLS keeps them private.
 *
 * ORDER, AND THE FALLBACK
 *   The `pages` row is keyed on the Notion page id, so the page comes first;
 *   then symbiont builds the row (syncPage) and the text and links are added.
 *   If anything after the Notion page fails, the text is written into the
 *   Notion page and Where is it set back to Notion: the submission becomes
 *   an ordinary Notion-owned one and is not lost, it just has no edit link.
 *   Only if that also fails does the writer see an error (their draft is still
 *   in their browser).
 *
 * WHY THE SUBMITTER GOES IN EDITORIAL NOTES, NOT AUTHORS
 *   `Authors` is a multi_select, and Notion creates a missing option rather
 *   than erroring. Writing a public form's name field into it would let every
 *   typo, and every spam post the honeypot misses, add a permanent byline
 *   option. An editor sets Authors on acceptance, when they are checking the
 *   byline anyway. The email also stays out of any synced column this way.
 */
import { Client } from '@notionhq/client';
import { randomUUID } from 'node:crypto';
import {
  createPageFromMarkdown,
  replacePageMarkdown,
  requireEnvVar,
  syncPage,
  uploadBufferToSupabase,
  withNotionRetry,
} from 'symbiont-cms/server';
import { ARTICLES_ALIAS, symbiont } from '$lib/symbiont.js';
import { symbiontSync } from '$lib/symbiont.server.js';
import { adminDb } from '$lib/server/admin-db.js';
import { newShareToken, shareUrl, storeShareLinks } from '$lib/server/share-links.js';
import { infoWithEditLink, placeholderBody } from '$lib/server/web-editor.js';
import {
  EDITORIAL_NOTES_PROPERTY,
  INFO_PROPERTY,
  TAGS_PROPERTY,
  TITLE_PROPERTY,
  WEB_SUBMISSION_TAG,
  WHERE_IS_IT_NOTION_PAGE,
  WHERE_IS_IT_PROPERTY,
  WHERE_IS_IT_WEB_EDITOR,
  WORD_COUNT_PROPERTY,
} from '$lib/sync/properties.js';
import { countWordsFromMarkdown } from '$lib/utils/word-count.js';
import {
  SUBMISSION_IMAGE_LIMITS,
  SUBMISSION_IMAGE_TYPES,
  SUBMISSION_INCOMING_PREFIX,
  SUBMISSION_MEDIA_PREFIX,
  type SubmissionInput,
} from '$lib/utils/submission.js';

function articlesDataSourceId(): string {
  const match = symbiont.config.databases.find((db) => db.alias === ARTICLES_ALIAS);
  if (!match) throw new Error(`${ARTICLES_ALIAS} is not configured in src/lib/symbiont.ts`);
  return match.dataSourceId;
}

const PACIFIC_STAMP = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  dateStyle: 'medium',
  timeStyle: 'short',
});

export interface CreatedSubmission {
  pageId: string;
  /** The row's `ID` as an editor sees it, e.g. TECH-812. Null if unreadable. */
  reference: string | null;
  /** The page in Notion, for the editors' notification. */
  notionUrl: string | null;
  /** The writer's edit link; null if the submission fell back to Notion-owned. */
  editUrl: string | null;
}

export async function createSubmission(input: SubmissionInput, now = new Date()): Promise<CreatedSubmission> {
  const notion = new Client({ auth: requireEnvVar('NOTION_TOKEN') });
  const editToken = newShareToken();

  const tags = [WEB_SUBMISSION_TAG, ...(input.category ? [input.category] : [])];
  const note = `Submitted via /submit by ${input.name} <${input.email}> on ${PACIFIC_STAMP.format(now)} PT.`;

  // Deliberately no Status: the new row takes the database's default, which
  // is wherever the editors' triage view already looks.
  const { id: pageId, page } = await createPageFromMarkdown(notion, {
    dataSourceId: articlesDataSourceId(),
    properties: {
      [TITLE_PROPERTY]: { title: [{ text: { content: input.title } }] },
      [TAGS_PROPERTY]: { multi_select: tags.map((name) => ({ name })) },
      [EDITORIAL_NOTES_PROPERTY]: { rich_text: [{ text: { content: note } }] },
      // The switch: the web editor owns the body (sync/hooks/content-source.ts).
      [WHERE_IS_IT_PROPERTY]: { select: { name: WHERE_IS_IT_WEB_EDITOR } },
      // The edit link, where editors can find it too. Also tells the sync this
      // page is already set up, so its first sync is not taken for a take-in.
      [INFO_PROPERTY]: { rich_text: infoWithEditLink([], shareUrl(editToken)) },
      // The sync's word-count hook never sees a web-owned body, so it is set
      // here and on every /share save instead.
      [WORD_COUNT_PROPERTY]: { rich_text: [{ text: { content: String(countWordsFromMarkdown(input.body)) } }] },
    },
    markdown: placeholderBody(shareUrl(editToken)),
  });

  const created = {
    pageId,
    reference: readShortId(page),
    notionUrl: typeof page.url === 'string' ? page.url : null,
  };

  try {
    // Builds the row through the normal pipeline. Its return value is not the
    // test of success: if the webhook got there first, processPage reports the
    // page unchanged and returns false. The content write below is the test.
    await syncPage(symbiontSync, ARTICLES_ALIAS, pageId);

    const { data, error } = await adminDb()
      .from('pages')
      .update({ content: input.body })
      .eq('page_id', pageId)
      .select('page_id');
    if (error) throw new Error(`content write failed: ${error.message}`);
    if (!data || data.length !== 1) throw new Error('the sync did not create a row for the new page');

    await storeShareLinks(pageId, [{ token: editToken, readOnly: false }]);

    return { ...created, editUrl: shareUrl(editToken) };
  } catch (error) {
    console.error('[submit] web_ownership_failed: falling back to a Notion-owned page', {
      pageId,
      reason: error instanceof Error ? error.message : String(error),
    });
    // Notion then owns the text, so the content-source hooks sync it normally.
    // The body goes first: if the property write then failed, the page would
    // still say Web Editor, but with the real text in it rather than a link.
    await replacePageMarkdown(notion, pageId, input.body);
    await withNotionRetry(() =>
      notion.pages.update({
        page_id: pageId,
        properties: {
          [WHERE_IS_IT_PROPERTY]: { select: { name: WHERE_IS_IT_NOTION_PAGE } },
          // Its edit link may never have been stored; a dead link is worse than
          // none. Info held nothing else yet -- the page is seconds old.
          [INFO_PROPERTY]: { rich_text: [] },
        },
      }),
    );
    return { ...created, editUrl: null };
  }
}

/** Find the unique_id column without naming it; it is display-only here. */
function readShortId(page: unknown): string | null {
  const properties = (page as { properties?: Record<string, any> }).properties ?? {};
  for (const value of Object.values(properties)) {
    if (value?.type !== 'unique_id') continue;
    const { prefix, number } = value.unique_id ?? {};
    if (typeof number !== 'number') return null;
    return prefix ? `${prefix}-${number}` : String(number);
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Images                                                                      */
/* -------------------------------------------------------------------------- */

/*
 * THE PATH AN IMAGE TAKES
 *
 *   1. sign     the browser asks for a signed upload URL for one new object
 *               under submissions/incoming/.
 *   2. (upload) the browser PUTs the original straight to Supabase. It never
 *               passes through a Vercel function, so Vercel's 4.5 MB request
 *               limit does not apply and nobody's photo is shrunk to fit it.
 *   3. confirm  the server downloads that original, re-encodes it (below),
 *               stores the result, and deletes the original.
 *
 * Google Docs images skip 1-2: the server fetches them itself (fetchRemote).
 * An original that is uploaded and never confirmed stays under incoming/;
 * those are safe to delete by hand at any age older than a day.
 */

/** A failure the submitter can act on; its message is shown to them. */
export class SubmissionImageError extends Error {}

const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp', 'gif', 'avif', 'tiff']);

const EXTENSION: Record<(typeof SUBMISSION_IMAGE_TYPES)[number], string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

export interface StoredImage {
  url: string;
  width: number;
  height: number;
}

function serviceClient() {
  return symbiont.getSSRClient(undefined, requireEnvVar('SUPABASE_SERVICE_ROLE_KEY'));
}

/** Step 1. */
export async function signSubmissionUpload(contentType: string): Promise<{ path: string; signedUrl: string }> {
  const extension = EXTENSION[contentType as keyof typeof EXTENSION];
  if (!extension) {
    // HEIC lands here, and would fail later anyway: sharp's prebuilt binaries
    // cannot decode it. iOS converts to JPEG when uploading from a browser, so
    // this is mostly desktop Macs dragging straight out of Photos.
    throw new SubmissionImageError('Please upload a JPEG, PNG, WebP or GIF image.');
  }

  const path = `${SUBMISSION_INCOMING_PREFIX}${randomUUID()}.${extension}`;
  const { data, error } = await serviceClient().storage.from('media').createSignedUploadUrl(path);
  if (error || !data) throw new Error(`createSignedUploadUrl failed: ${error?.message ?? 'no data'}`);
  return { path, signedUrl: data.signedUrl };
}

const INCOMING_PATH = new RegExp(
  `^${SUBMISSION_INCOMING_PREFIX.replace(/[/]/g, '\\/')}[0-9a-f-]{36}\\.(?:${Object.values(EXTENSION).join('|')})$`,
);

/** Step 3. */
export async function confirmSubmissionUpload(path: string): Promise<StoredImage> {
  // Only ever a path we signed. Without this, confirm would be a way to make
  // the server read -- and then delete -- any object in the bucket.
  if (!INCOMING_PATH.test(path)) throw new SubmissionImageError('That upload could not be found.');

  const storage = serviceClient().storage.from('media');
  try {
    const { data, error } = await storage.download(path);
    if (error || !data) throw new SubmissionImageError('That upload could not be found.');
    if (data.size > SUBMISSION_IMAGE_LIMITS.uploadBytes) {
      throw new SubmissionImageError('That image is too large to upload.');
    }
    return await storeSubmissionImage(Buffer.from(await data.arrayBuffer()));
  } finally {
    // Success or failure, the original has served its purpose. Best effort:
    // a leftover under incoming/ is litter, not a leak of anything.
    await storage.remove([path]).catch(() => undefined);
  }
}

/**
 * Google Docs images, fetched by the server because the page cannot.
 *
 * This is a server-side fetch of a URL the public chose, so the host is
 * allowlisted and every redirect hop is re-checked by hand: following
 * redirects automatically would let an allowed URL bounce the request to any
 * host, internal ones included. googleusercontent.com is the only entry
 * because it is the only place a pasted Doc keeps its images -- and it is
 * already trusted this way by symbiont's needsUploadToSupabase.
 */
export async function fetchRemoteSubmissionImage(src: string): Promise<StoredImage> {
  let url = src;
  for (let hop = 0; hop < 4; hop++) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      break;
    }
    if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.googleusercontent.com')) break;

    const response = await fetch(parsed, { redirect: 'manual', signal: AbortSignal.timeout(15_000) });
    if (response.status >= 300 && response.status < 400) {
      const next = response.headers.get('location');
      if (!next) break;
      url = new URL(next, parsed).toString();
      continue;
    }
    if (!response.ok) break;

    const declared = Number(response.headers.get('content-length') ?? 0);
    if (declared > SUBMISSION_IMAGE_LIMITS.uploadBytes) {
      throw new SubmissionImageError('A pasted image is too large to copy.');
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > SUBMISSION_IMAGE_LIMITS.uploadBytes) {
      throw new SubmissionImageError('A pasted image is too large to copy.');
    }
    return storeSubmissionImage(buffer);
  }
  throw new SubmissionImageError(
    'Some pasted images could not be copied, so they were removed. Please add them with the image button.',
  );
}

/**
 * Re-encode an image and put the result in the `media` bucket.
 *
 * Always re-encoded, never stored as sent, for three reasons:
 *   - Phone photos carry EXIF, GPS coordinates included. sharp writes no
 *     metadata unless asked to, so re-encoding is what strips it. A student
 *     photographing their dorm should not publish where it is.
 *   - A file that merely claims to be an image (a polyglot, or an HTML page
 *     with a .png name) does not survive being decoded and re-encoded.
 *   - It caps the dimensions, so a 50-megapixel original does not become a
 *     50-megapixel article image.
 *
 * WebP because it keeps transparency (screenshots, graphics), which JPEG
 * cannot, at a fraction of PNG's size, and every browser and Notion display it.
 * Animated GIFs keep their first frame only.
 */
async function storeSubmissionImage(input: Buffer, now = new Date()): Promise<StoredImage> {
  // Lazy, as with the PDF thumbnailer in sync/hooks/tech.ts: only this route
  // pays for loading the native module.
  const { default: sharp } = await import('sharp');

  // limitInputPixels guards against a small file that decodes to an enormous
  // bitmap -- a decompression bomb would otherwise run the lambda out of memory.
  const image = sharp(input, { limitInputPixels: 120_000_000 });
  let format: string | undefined;
  try {
    format = (await image.metadata()).format;
  } catch {
    throw new SubmissionImageError('That file does not look like an image we can read.');
  }
  if (!format || !ACCEPTED_FORMATS.has(format)) {
    throw new SubmissionImageError('Please upload a JPEG, PNG, WebP or GIF image.');
  }

  const { data, info } = await image
    .rotate() // apply EXIF orientation before the metadata that carries it is dropped
    .resize({
      width: SUBMISSION_IMAGE_LIMITS.maxEdge,
      height: SUBMISSION_IMAGE_LIMITS.maxEdge,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });

  // Random, not derived from the upload's name: the name is the submitter's
  // (IMG_2041.jpg, or their full name), and nothing downstream needs it.
  const month = now.toISOString().slice(0, 7);
  const path = `${SUBMISSION_MEDIA_PREFIX}${month}/${randomUUID()}.webp`;

  const uploaded = await uploadBufferToSupabase(data, {
    supabase: serviceClient(),
    filename: path,
    contentType: 'image/webp',
  });

  return { url: uploaded.newUrl, width: info.width, height: info.height };
}

/* -------------------------------------------------------------------------- */
/* Rate limiting                                                               */
/* -------------------------------------------------------------------------- */

/**
 * A sliding window per client address, in this instance's memory.
 *
 * Best effort, and knowingly so: on Vercel each warm lambda has its own Map and
 * a cold start empties it, so a determined sender spread across instances gets
 * more than the limit. What it does stop is the common case -- one script
 * hammering one warm instance -- without a table, a KV store or a new secret.
 * If that stops being enough, Vercel's WAF can rate-limit the route at the
 * edge with no code change; that is the next step, not a shared counter here.
 */
export function createRateLimiter(maxPerWindow: number, windowMs = 60 * 60 * 1000) {
  const recent = new Map<string, number[]>();

  return function allow(clientAddress: string, now = Date.now()): boolean {
    const cutoff = now - windowMs;
    const hits = (recent.get(clientAddress) ?? []).filter((t) => t > cutoff);

    // Opportunistic sweep so a long-lived instance cannot grow without bound.
    if (recent.size > 1000) {
      for (const [key, times] of recent) {
        if (times.every((t) => t <= cutoff)) recent.delete(key);
      }
    }

    if (hits.length >= maxPerWindow) {
      recent.set(clientAddress, hits);
      return false;
    }
    hits.push(now);
    recent.set(clientAddress, hits);
    return true;
  };
}

/** Pieces sent, per address per hour. */
export const allowSubmission = createRateLimiter(5);

/**
 * Images uploaded, per address per hour. Counted separately and more
 * generously: a photo essay is one submission and twenty uploads, and an
 * image that is uploaded then deleted from the draft still counts.
 */
export const allowImageUpload = createRateLimiter(40);

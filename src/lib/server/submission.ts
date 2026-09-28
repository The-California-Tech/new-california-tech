/**
 * /submit's write path: one public form post becomes one Notion page in
 * tech-article-staging.
 *
 * Under `$lib/server` so SvelteKit refuses to bundle it for the browser -- it
 * holds the Notion token.
 *
 * WHY STAGING AND NOT A SEPARATE INBOX
 *   Editors triage where they already work. The row carries `No Sync`, which
 *   the sync's page:should-sync hook skips *without deleting*, so an
 *   unreviewed submission never reaches Postgres however many times the
 *   automation fires on it. Accepting a piece is removing that tag.
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
import { env } from '$env/dynamic/private';
import { uploadBufferToSupabase, withNotionRetry } from 'symbiont-cms/server';
import { symbiont } from '$lib/symbiont.js';
import {
  EDITORIAL_NOTES_PROPERTY,
  NO_SYNC_TAG,
  TAGS_PROPERTY,
  TITLE_PROPERTY,
  WEB_SUBMISSION_TAG,
} from '$lib/sync/properties.js';
import {
  SUBMISSION_IMAGE_LIMITS,
  SUBMISSION_IMAGE_TYPES,
  SUBMISSION_INCOMING_PREFIX,
  SUBMISSION_MEDIA_PREFIX,
  type SubmissionInput,
} from '$lib/utils/submission.js';

/**
 * Through SvelteKit's `$env`, not symbiont's requireEnvVar. That one reads
 * `process.env`, which Vite's dev server does not populate from `.env` -- so
 * it works on Vercel and fails locally, and /submit is exercised locally far
 * more often than the sync is.
 */
function secret(name: 'NOTION_TOKEN' | 'SUPABASE_SERVICE_ROLE_KEY'): string {
  const value = env[name];
  if (!value) throw new Error(`Missing required environment variable '${name}'.`);
  return value;
}

const STAGING_ALIAS = 'tech-article-staging';

function stagingDataSourceId(): string {
  const match = symbiont.config.databases.find((db) => db.alias === STAGING_ALIAS);
  if (!match) throw new Error(`${STAGING_ALIAS} is not configured in src/lib/symbiont.ts`);
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
}

export async function createSubmission(input: SubmissionInput, now = new Date()): Promise<CreatedSubmission> {
  const notion = new Client({ auth: secret('NOTION_TOKEN') });

  const tags = [NO_SYNC_TAG, WEB_SUBMISSION_TAG, ...(input.category ? [input.category] : [])];
  const note = `Submitted via /submit by ${input.name} <${input.email}> on ${PACIFIC_STAMP.format(now)} PT.`;

  // Deliberately no Status: the new row takes the database's default, which
  // is wherever the editors' triage view already looks.
  const response = await withNotionRetry(() =>
    notion.pages.create({
      parent: { type: 'data_source_id', data_source_id: stagingDataSourceId() },
      properties: {
        [TITLE_PROPERTY]: { title: [{ text: { content: input.title } }] },
        [TAGS_PROPERTY]: { multi_select: tags.map((name) => ({ name })) },
        [EDITORIAL_NOTES_PROPERTY]: { rich_text: [{ text: { content: note } }] },
      },
      // Notion's own markdown parser, as scripts/importGoogleDoc.ts uses. The
      // body has already been through stripMarkupTags, which matters here:
      // this dialect treats XML-like tags as mentions and page references.
      markdown: input.body,
    }),
  );

  return { pageId: response.id, reference: readShortId(response) };
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
  return symbiont.getSSRClient(undefined, secret('SUPABASE_SERVICE_ROLE_KEY'));
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

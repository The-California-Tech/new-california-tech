/**
 * Getting an image from wherever the submitter's copy lives into our bucket.
 *
 * Every image in the editor starts life with a `src` we do not host -- an
 * object URL for a file just picked or dropped, a `data:` URI from Word, a
 * googleusercontent URL from Google Docs -- and SubmissionEditor swaps it for
 * the uploaded URL. This file knows how to turn each kind of `src` into
 * something the upload route accepts.
 *
 * WHY NOT JUST fetch(src)
 *   The site's CSP limits connect-src to 'self' and Supabase, which rules out
 *   fetching `blob:`, `data:` and Google's hosts from the page. So files are
 *   kept in memory rather than refetched, `data:` URIs are decoded by hand, and
 *   Google's URLs are handed to the server to fetch (it allowlists the host).
 *   Supabase *is* in connect-src, which is what lets the browser upload there.
 */
import { SUPABASE_PUBLISHABLE_KEY } from '$lib/symbiont';
import { SUBMISSION_IMAGE_LIMITS, SUBMISSION_IMAGE_TYPES } from '$lib/utils/submission';

export interface UploadedImage {
  url: string;
  width: number;
  height: number;
}

/** A failure worth showing the submitter; its message is written for them. */
export class ImageRehostError extends Error {}

const staged = new Map<string, Blob>();

/** An object URL the editor can show at once, remembered so it can be uploaded. */
export function stageFile(file: Blob): string {
  const url = URL.createObjectURL(file);
  staged.set(url, file);
  return url;
}

/**
 * Same test the server applies (see /api/submit/image). Checked here too only
 * to fail fast, without a round trip, on images that will certainly be refused.
 */
function isFetchableRemote(src: string): boolean {
  try {
    const url = new URL(src);
    return url.protocol === 'https:' && url.hostname.endsWith('.googleusercontent.com');
  } catch {
    return false;
  }
}

function decodeDataUri(src: string): Blob | null {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.*)$/is.exec(src);
  if (!match) return null;
  try {
    const bytes = Uint8Array.from(atob(match[2]!), (c) => c.charCodeAt(0));
    return new Blob([bytes], { type: match[1] });
  } catch {
    return null;
  }
}

async function call<T>(payload: Record<string, string>): Promise<T> {
  let response: Response;
  try {
    response = await fetch('/api/submit/image', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new ImageRehostError('An image could not be uploaded. Check your connection and try again.');
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new ImageRehostError(body.error ?? 'An image could not be uploaded.');
  return body as T;
}

/**
 * Send the original, untouched, straight to Supabase.
 *
 * Not through our own route: Vercel refuses a function request body over
 * 4.5 MB before our code runs, and shrinking photos in the browser to fit that
 * would throw away detail for a reason that has nothing to do with the paper.
 * The server signs an upload URL for one new object, the browser PUTs the file
 * to it, and the server then takes it from there (see confirm).
 */
async function uploadOriginal(blob: Blob): Promise<UploadedImage> {
  if (!(SUBMISSION_IMAGE_TYPES as readonly string[]).includes(blob.type)) {
    throw new ImageRehostError('Please add images as JPEG, PNG, WebP or GIF.');
  }
  if (blob.size > SUBMISSION_IMAGE_LIMITS.uploadBytes) {
    const mb = Math.round(SUBMISSION_IMAGE_LIMITS.uploadBytes / (1024 * 1024));
    throw new ImageRehostError(`One image is over ${mb} MB. Please send it to tech@caltech.edu instead.`);
  }

  const { path, signedUrl } = await call<{ path: string; signedUrl: string }>({
    action: 'sign',
    contentType: blob.type,
  });

  let put: Response;
  try {
    put = await fetch(signedUrl, {
      method: 'PUT',
      body: blob,
      headers: { 'content-type': blob.type, 'x-upsert': 'false', apikey: SUPABASE_PUBLISHABLE_KEY },
    });
  } catch {
    throw new ImageRehostError('An image could not be uploaded. Check your connection and try again.');
  }
  if (!put.ok) throw new ImageRehostError('An image could not be uploaded. Please try again.');

  return call<UploadedImage>({ action: 'confirm', path });
}

/** Upload whatever `src` points at, and return where it lives now. */
export async function rehost(src: string): Promise<UploadedImage> {
  const blob = staged.get(src) ?? decodeDataUri(src);
  if (blob) return uploadOriginal(blob);
  if (isFetchableRemote(src)) return call<UploadedImage>({ action: 'remote', url: src });

  // file:// from Word, or an image from a site that is not Google's.
  throw new ImageRehostError(
    'Some pasted images could not be copied, so they were removed. Please add them with the image button.',
  );
}

/** Free a staged file once it no longer needs uploading. */
export function releaseStaged(src: string): void {
  if (!staged.delete(src)) return;
  URL.revokeObjectURL(src);
}

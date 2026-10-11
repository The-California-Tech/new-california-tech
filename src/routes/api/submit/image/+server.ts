import type { RequestHandler } from './$types';
import {
  allowImageUpload,
  confirmSubmissionUpload,
  fetchRemoteSubmissionImage,
  signSubmissionUpload,
  SubmissionImageError,
} from '#lib/server/submission.ts';

/**
 * Image uploads for /submit's editor. See the image section of
 * $lib/server/submission.ts for the whole path; this only routes to it.
 *
 *   { action: 'sign', contentType }  -> { path, signedUrl }
 *   { action: 'confirm', path }      -> { url, width, height }
 *   { action: 'remote', url }        -> { url, width, height }
 *
 * JSON rather than a form post, which also means a page on another site
 * cannot call this through a visitor's browser: a cross-origin JSON POST needs
 * a CORS preflight, and this route answers none. A direct script can, within
 * the rate limit -- the accepted cost of taking uploads without sign-in.
 */
export const POST: RequestHandler = async ({ request, getClientAddress }) => {
  let body: { action?: unknown; contentType?: unknown; path?: unknown; url?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'The request did not arrive intact.' }, { status: 400 });
  }

  // Counted once per image: at sign for uploads, at fetch for pasted ones.
  // Confirm is not counted, since it can only follow a sign.
  if ((body.action === 'sign' || body.action === 'remote') && !allowImageUpload(getClientAddress())) {
    return Response.json({ error: 'Too many images in the last hour. Please try again later.' }, { status: 429 });
  }

  try {
    switch (body.action) {
      case 'sign':
        return Response.json(await signSubmissionUpload(String(body.contentType ?? '')));
      case 'confirm':
        return Response.json(await confirmSubmissionUpload(String(body.path ?? '')));
      case 'remote':
        return Response.json(await fetchRemoteSubmissionImage(String(body.url ?? '')));
      default:
        return Response.json({ error: 'Unknown action.' }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof SubmissionImageError) {
      return Response.json({ error: error.message }, { status: 422 });
    }
    console.error('[submit] image_failed', body.action, error instanceof Error ? error.message : error);
    return Response.json({ error: 'The image could not be saved. Please try again.' }, { status: 502 });
  }
};

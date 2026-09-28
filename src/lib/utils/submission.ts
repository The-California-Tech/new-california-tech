/**
 * The /submit form's vocabulary and rules, shared by the page and its action.
 *
 * Pure on purpose: no Notion, no SvelteKit, so it can be tested with
 * `node --experimental-strip-types` and imported by the browser bundle without
 * dragging server code along. The Notion write lives in
 * `$lib/server/submission.ts`.
 */

/**
 * Offered to submitters, and written verbatim as a `Tags` option.
 *
 * These must match existing options in tech-article-staging *exactly*: Notion
 * creates a missing option rather than erroring, so a near-miss ("Arts &
 * Entertainment", which is what the old site offered) would quietly add a new
 * tag that no feed filter knows about.
 */
export const SUBMISSION_CATEGORIES = [
  'News',
  'Opinion',
  'Letter to the Editor',
  'Feature',
  'Arts',
  'Sports',
  'Science & Tech',
  'Humor',
] as const;

export type SubmissionCategory = (typeof SUBMISSION_CATEGORIES)[number];

/**
 * The honeypot's field name. Something no browser autofill heuristic matches
 * -- "website", "company", "url" and "nickname" all get filled in for real
 * people, who would then be silently discarded.
 */
export const HONEYPOT_FIELD = 'hp_confirm';

export const SUBMISSION_LIMITS = {
  name: 100,
  email: 254,
  title: 200,
  /**
   * Characters of markdown. Well under the ~400k at which Notion's markdown
   * import goes async (see scripts/importGoogleDoc.ts), so the action never has
   * to poll, and far beyond any article the paper prints.
   */
  body: 100_000,
} as const;

/* -------------------------------------------------------------------------- */
/* Images                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Where submission images live inside the `media` bucket.
 *
 * A prefix of their own because symbiont's cleanupUnusedMedia deletes any
 * object no `pages` row references -- and a submission, by design, has no
 * `pages` row until an editor accepts it. Every caller of that sweep must pass
 * this in `excludePrefixes`; see scripts/pdfCoverBackfill.ts.
 */
export const SUBMISSION_MEDIA_PREFIX = 'submissions/';

/**
 * Where an original lands before the server has checked and re-encoded it.
 * Inside SUBMISSION_MEDIA_PREFIX, so the cleanup exclusion covers it too.
 */
export const SUBMISSION_INCOMING_PREFIX = `${SUBMISSION_MEDIA_PREFIX}incoming/`;

export const SUBMISSION_IMAGE_LIMITS = {
  /**
   * Bytes of original file. The browser uploads straight to Supabase with a
   * signed URL, so this is not bound by Vercel's 4.5 MB request limit -- a
   * full-size phone photo or a DSLR JPEG goes up as it is. Generous on
   * purpose; it exists only so the lambda that re-encodes it cannot be handed
   * something absurd.
   */
  uploadBytes: 25 * 1024 * 1024,
  /** Longest edge after the server re-encodes. Past print resolution for a column. */
  maxEdge: 2400,
} as const;

/** Content types the upload route will sign for. */
export const SUBMISSION_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'] as const;

/** Public URLs of the `media` bucket, for the project at `supabaseUrl`. */
export function mediaPublicUrlPrefix(supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/media/`;
}

const MARKDOWN_IMAGE = /!\[([^\]]*)\]\(\s*<?([^\s)>]+)>?(?:\s+"[^"]*")?\s*\)/g;

/**
 * Drop every markdown image not already in our bucket.
 *
 * The editor re-hosts pasted images before a piece is sent, so in practice
 * this only removes what that could not reach (a `file://` path from Word, a
 * Google Docs image behind a login) or what a hand-built post slipped in.
 * The reason to enforce it here rather than trust the client: an off-site
 * image in Notion is loaded by every editor who opens the page, which makes it
 * a tracking pixel, and it can vanish or change after it has been reviewed.
 */
export function keepOnlyHostedImages(markdown: string, allowedPrefix: string): string {
  return markdown.replace(MARKDOWN_IMAGE, (whole, _alt: string, src: string) =>
    src.startsWith(allowedPrefix) ? whole : '',
  );
}

/**
 * caltech.edu and its subdomains (alumni.caltech.edu, its.caltech.edu, ...).
 * The old site asked for a Caltech address too; it is policy as much as
 * spam control, since the paper publishes its own community.
 */
const CALTECH_EMAIL = /^[^\s@]+@(?:[a-z0-9-]+\.)*caltech\.edu$/i;

export interface SubmissionInput {
  name: string;
  email: string;
  title: string;
  category: SubmissionCategory | null;
  body: string;
}

export type SubmissionField = keyof SubmissionInput;

export type SubmissionValidation =
  { ok: true; value: SubmissionInput } | { ok: false; errors: Partial<Record<SubmissionField, string>> };

/** Collapse whitespace in a one-line field; a pasted newline is never intended. */
function oneLine(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strip anything shaped like an HTML/XML tag.
 *
 * Not about XSS -- nothing here is rendered as HTML, and anything that reaches
 * the site later goes through the normal markdown renderer. It is about
 * Notion's markdown dialect, which gives XML-like tags real meaning: page and
 * database references, user mentions, embeds. An anonymous submitter should not
 * be able to create any of those inside the paper's workspace. Articles do not
 * need raw HTML, and a bare `<` followed by a space or digit ("a < b", "<3")
 * is left alone because it cannot open a tag. So are markdown autolinks
 * (`<https://...>`, `<name@caltech.edu>`): the tag name must end at whitespace,
 * `/` or `>`, and a scheme's `:` or an address's `@` ends it first.
 */
export function stripMarkupTags(markdown: string): string {
  return markdown.replace(/<\/?[a-zA-Z][a-zA-Z0-9-]*(?:\s[^<>]*)?\/?>/g, '');
}

/**
 * Undo the only three entities TipTap's markdown serializer writes.
 *
 * It encodes `&`, `<` and `>` in every text node (encodeHtmlEntities in
 * @tiptap/core), so "a < b" arrives as `a &lt; b`. Whether Notion's parser
 * decodes entities is not documented, and if it does not, readers' prose would
 * show them literally. Decoding here makes the editor and the plain-textarea
 * fallback send the same thing -- and it must run *before* stripMarkupTags, or
 * an encoded `&lt;page ...&gt;` would pass the strip and could be decoded into
 * a live tag downstream. `&amp;` goes last so `&amp;lt;` stays literal text.
 */
export function decodeEditorEntities(markdown: string): string {
  return markdown.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

export interface ValidateOptions {
  /** If set, images outside this URL prefix are removed from the body. */
  imageUrlPrefix?: string;
}

export function validateSubmission(
  raw: Record<string, unknown>,
  { imageUrlPrefix }: ValidateOptions = {},
): SubmissionValidation {
  const errors: Partial<Record<SubmissionField, string>> = {};

  const name = oneLine(raw.name);
  const email = oneLine(raw.email).toLowerCase();
  const title = oneLine(raw.title);
  const categoryRaw = oneLine(raw.category);
  let body = stripMarkupTags(decodeEditorEntities(String(raw.body ?? ''))).replace(/\r\n?/g, '\n');
  if (imageUrlPrefix) body = keepOnlyHostedImages(body, imageUrlPrefix);
  body = body.trim();

  if (!name) errors.name = 'Please tell us your name.';
  else if (name.length > SUBMISSION_LIMITS.name) errors.name = 'That name is too long.';

  if (!email) errors.email = 'Please give your Caltech email address.';
  else if (email.length > SUBMISSION_LIMITS.email || !CALTECH_EMAIL.test(email))
    errors.email = 'Please use a caltech.edu email address.';

  if (!title) errors.title = 'Please give your piece a title.';
  else if (title.length > SUBMISSION_LIMITS.title) errors.title = 'That title is too long.';

  // Blank is fine -- the editors will file it. Anything else must be one of
  // ours, because it becomes a Tags option verbatim.
  let category: SubmissionCategory | null = null;
  if (categoryRaw) {
    const match = SUBMISSION_CATEGORIES.find((c) => c === categoryRaw);
    if (match) category = match;
    else errors.category = 'Please choose a category from the list.';
  }

  if (!body) errors.body = 'Your piece is empty.';
  else if (body.length > SUBMISSION_LIMITS.body)
    errors.body = `That is longer than we can accept online (${SUBMISSION_LIMITS.body.toLocaleString('en-US')} characters). Please email it to tech@caltech.edu instead.`;

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { name, email, title, category, body } };
}

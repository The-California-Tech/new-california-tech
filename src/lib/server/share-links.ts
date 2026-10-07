/**
 * /share/<token>: the edit link to a web-editor article. One per article,
 * kept for as long as the article exists. It goes to the writer (thank-you
 * page, confirmation email) and into the Notion page (placeholder body and the
 * Info line), so editors can use it too.
 *
 * A token is 192 random bits, base64url -- unguessable, so the link itself is
 * the credential. Stored as-is (public.share_links): hashing would only help if
 * that table leaked, but the same links are in Notion in clear, and storing them
 * is what lets the sync find a page's link again (see editLinkForPage).
 *
 * Whether the link can edit is NOT stored. It depends on the article: only
 * while Where is it = Web Editor (checked on every load and save -- see the
 * /share route). Moving the article to Notion stops the link; moving it back
 * re-opens it.
 *
 * read_only is unused: a read-only link was planned for the Notion page, but
 * with the edit link on the same page it would have protected nothing. /share
 * still honours it, should outsider read-only links ever be wanted.
 */
import { randomBytes } from 'node:crypto';
import { siteConfig } from '$config/site';
import { adminDb } from '$lib/server/admin-db';

export function newShareToken(): string {
  return randomBytes(24).toString('base64url');
}

/** Absolute URL for a token: it goes in emails and in Notion. */
export function shareUrl(token: string): string {
  return new URL(`/share/${token}`, siteConfig.url).href;
}

/** A token is base64url of 24 bytes: 32 characters of [A-Za-z0-9_-]. */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{32}$/;

/**
 * @param db  the service-role client to use. Defaults to a new one; the sync
 *   passes its own, which is already service-role.
 */
export async function storeShareLinks(
  pageId: string,
  links: Array<{ token: string; readOnly: boolean }>,
  db: Pick<ReturnType<typeof adminDb>, 'from'> = adminDb(),
): Promise<void> {
  const { error } = await db
    .from('share_links')
    .insert(links.map(({ token, readOnly }) => ({ token, page_id: pageId, read_only: readOnly })));
  if (error) throw new Error(`share_links insert failed: ${error.message}`);
}

export interface ResolvedShare {
  pageId: string;
  readOnly: boolean;
}

/**
 * The link behind a token, or null for anything that is not one of ours.
 *
 * @param db  the service-role client to use; defaults to a new one.
 */
export async function resolveShareToken(
  token: string,
  db: Pick<ReturnType<typeof adminDb>, 'from'> = adminDb(),
): Promise<ResolvedShare | null> {
  // Cheap rejection of garbage before it costs a query.
  if (!TOKEN_SHAPE.test(token)) return null;
  const { data, error } = await db.from('share_links').select('page_id, read_only').eq('token', token).maybeSingle();
  if (error) throw new Error(`share_links lookup failed: ${error.message}`);
  return data ? { pageId: data.page_id, readOnly: data.read_only } : null;
}

/**
 * The article's edit link token, if it has one.
 *
 * @param db  the service-role client to use; defaults to a new one.
 */
export async function editLinkForPage(
  pageId: string,
  db: Pick<ReturnType<typeof adminDb>, 'from'> = adminDb(),
): Promise<string | null> {
  const { data, error } = await db
    .from('share_links')
    .select('token')
    .eq('page_id', pageId)
    .eq('read_only', false)
    .maybeSingle();
  if (error) throw new Error(`share_links lookup failed: ${error.message}`);
  return data?.token ?? null;
}

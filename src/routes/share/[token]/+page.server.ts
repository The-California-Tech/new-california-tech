import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { Client, type PageObjectResponse } from '@notionhq/client';
import { renderMarkdownToHtml, requireEnvVar, withNotionRetry } from 'symbiont-cms/server';
import { SUPABASE_URL, symbiont } from '$lib/symbiont';
import { adminDb } from '$lib/server/admin-db';
import { resolveShareToken } from '$lib/server/share-links';
import { createRateLimiter } from '$lib/server/submission';
import { readContentSource } from '$lib/sync/hooks/content-source';
import { TITLE_PROPERTY, WORD_COUNT_PROPERTY } from '$lib/sync/properties';
import { countWordsFromMarkdown } from '$lib/utils/word-count';
import { mediaPublicUrlPrefix, validatePieceEdit, type PieceEditField } from '$lib/utils/submission';

export const prerender = false;

/** Saves per address per hour: generous for real editing, a ceiling for scripts. */
const allowSave = createRateLimiter(120);

interface SharedPiece {
  pageId: string;
  title: string;
  body: string;
  /** This link can edit, and the article still belongs to the web editor. */
  editable: boolean;
  /** An edit link whose article has been handed to Notion. */
  locked: boolean;
}

/**
 * The article behind a token, and whether this link may change it.
 *
 * Editable needs both: an edit (not read-only) link, and the article still
 * owned by the web editor (meta.contentSource, set by the sync from Where is
 * it). Read on every load and every save, so a switch in Notion takes effect at
 * the next sync, including mid-edit -- and switching back re-opens the link.
 */
async function loadShare(token: string): Promise<SharedPiece | null> {
  const link = await resolveShareToken(token);
  if (!link) return null;

  const { data: row, error: dbError } = await adminDb()
    .from('pages')
    .select('page_id, title, content, meta')
    .eq('page_id', link.pageId)
    .maybeSingle();
  if (dbError) throw new Error(`pages lookup failed: ${dbError.message}`);
  if (!row) return null;

  const ownedByWeb = (row.meta as Record<string, unknown> | null)?.contentSource === 'web';
  return {
    pageId: row.page_id,
    title: row.title,
    body: row.content ?? '',
    editable: !link.readOnly && ownedByWeb,
    locked: !link.readOnly && !ownedByWeb,
  };
}

export const load: PageServerLoad = async ({ params, setHeaders }) => {
  // The URL is a credential: never cached by anyone, never sent on as a
  // Referer, never indexed.
  setHeaders({
    'cache-control': 'private, no-store',
    'referrer-policy': 'no-referrer',
    'x-robots-tag': 'noindex, nofollow',
  });

  const piece = await loadShare(params.token);
  if (!piece) error(404, 'This link does not lead anywhere. It may have been mistyped.');

  return {
    title: piece.title,
    body: piece.body,
    editable: piece.editable,
    locked: piece.locked,
    // Rendered for the read-only view; the editor gets the markdown.
    html: piece.editable ? null : (await renderMarkdownToHtml(piece.body, symbiont.config.markdown)).html,
  };
};

type FormErrors = Partial<Record<PieceEditField | 'form', string>>;

export const actions: Actions = {
  default: async ({ params, request, getClientAddress }) => {
    const piece = await loadShare(params.token);
    if (!piece) error(404, 'This link does not lead anywhere.');

    const form = await request.formData();
    const values = { title: String(form.get('title') ?? ''), body: String(form.get('body') ?? '') };

    if (!piece.editable) {
      const errors: FormErrors = {
        form: piece.locked
          ? 'The editors have taken this piece over, so it can no longer be changed here. Your last saved version is what they have.'
          : 'This is a read-only link.',
      };
      return fail(409, { errors, values });
    }

    if (!allowSave(getClientAddress())) {
      const errors: FormErrors = { form: 'Too many saves in the last hour. Please wait a little and try again.' };
      return fail(429, { errors, values });
    }

    const result = validatePieceEdit(values, { imageUrlPrefix: mediaPublicUrlPrefix(SUPABASE_URL) });
    if (!result.ok) return fail(400, { errors: result.errors as FormErrors, values });
    const { title, body } = result.value;
    const notion = new Client({ auth: requireEnvVar('NOTION_TOKEN') });

    /*
     * Ask Notion, not only the stored state. When an editor moves Where is it
     * away from Web Editor, the sync that hands the text over reads
     * pages.content as it starts; a save landing while that sync is still
     * running would pass the stored-state check above, be written, and then be
     * overwritten by the sync's older copy. Checking Notion's live value
     * narrows that window from a whole sync to the moment between this read
     * and the write below. One extra Notion read per save.
     */
    let current: PageObjectResponse;
    try {
      current = (await withNotionRetry(() => notion.pages.retrieve({ page_id: piece.pageId }))) as PageObjectResponse;
    } catch (readError) {
      console.error('[share] notion_check_failed', {
        pageId: piece.pageId,
        reason: readError instanceof Error ? readError.message : String(readError),
      });
      const errors: FormErrors = { form: 'Could not reach Notion to save. Please try again in a moment.' };
      return fail(502, { errors, values });
    }
    if (readContentSource({ page: current }) !== 'web') {
      const errors: FormErrors = {
        form: 'The editors have just taken this piece over, so this save was not kept. Your last saved version is what they have.',
      };
      return fail(409, { errors, values });
    }

    try {
      // Notion first, in one request. The title is a Notion property: if
      // pages.title were changed alone, the next sync would put the old one
      // back. Word Count, because the sync's word-count hook never sees a
      // web-owned body. Only what changed is sent, so a save that changes
      // neither does not touch Notion at all.
      const properties: Record<string, unknown> = {};
      if (title !== piece.title) {
        properties[TITLE_PROPERTY] = { title: [{ text: { content: title } }] };
      }
      if (body !== piece.body) {
        properties[WORD_COUNT_PROPERTY] = {
          rich_text: [{ text: { content: String(countWordsFromMarkdown(body)) } }],
        };
      }
      if (Object.keys(properties).length) {
        await withNotionRetry(() =>
          notion.pages.update({ page_id: piece.pageId, properties } as Parameters<Client['pages']['update']>[0]),
        );
      }

      // The body is the web editor's alone while it owns the article; the sync
      // does not write `content` for it (content:should-sync).
      const { error: dbError } = await adminDb()
        .from('pages')
        .update({ content: body, title })
        .eq('page_id', piece.pageId);
      if (dbError) throw new Error(dbError.message);
    } catch (saveError) {
      console.error('[share] save_failed', {
        pageId: piece.pageId,
        reason: saveError instanceof Error ? saveError.message : String(saveError),
      });
      const errors: FormErrors = {
        form: 'Something went wrong and your changes were not saved. Please try again in a moment.',
      };
      return fail(502, { errors, values });
    }

    return { saved: true as const, savedAt: new Date().toISOString() };
  },
};

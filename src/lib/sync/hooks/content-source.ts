/**
 * Who owns an article's body: Notion, or the web editor.
 *
 * The switch is `Where is it` -- it already says where the working copy lives.
 * Notion always owns the properties (Status, Layout, Authors...); this only
 * decides where `pages.content` comes from:
 *
 *   Where is it = Web Editor   /submit and /share write pages.content; the sync
 *                              skips the body entirely (content:should-sync), so
 *                              it can neither read the Notion placeholder over
 *                              the real text nor race a save
 *   anything else, or blank    the sync reads the body from Notion, as always
 *
 * meta.contentSource records the switch as of the last sync. Only `web` is ever
 * written; absence means Notion. That stored value is how a CHANGE is detected,
 * the same way `Layout Applied` remembers the last preset: Notion keeps no
 * property history to ask.
 *
 * INTO WEB EDITOR (from anything, including a page that was web-owned before)
 * is a TAKE-IN:
 *   1. this sync reads the Notion body one last time, so pages.content holds
 *      the final Notion text;
 *   2. after the row is saved (sync:result), the page gets its web-editor
 *      setup: its edit link (the one it already has in share_links, else a new
 *      one), the Notion body replaced by a placeholder pointing to it, and the
 *      link written into Info.
 * Step 2 runs after the save on purpose: if it fails, the text is already safe
 * in the database. It is also self-healing: a page that is web-owned but whose
 * Info has no edit-link line gets the setup again on the next sync.
 *
 * Pages /submit creates arrive already set up (placeholder body, Info line),
 * so their first sync is not a take-in -- the Info line is how that is told.
 *
 * OUT OF WEB EDITOR (to any value, or blank) is a HANDOFF, on page:before: the
 * stored body is written into the Notion page before the content pipeline
 * reads it, so the same sync reads the real text back. It fails closed: if the
 * write fails, the row stays `web` and content is skipped, so nothing reads the
 * placeholder over the real text, and the next sync tries again.
 *
 * Edit links are never revoked. /share checks the current state, so a handoff
 * stops them and a later take-in re-opens them: handing a piece back to its
 * writer is a legitimate thing for editors to do.
 */
import type { Hook, HookContext, SyncResultReport } from 'symbiont-cms';
import { getPropertyNamedValue, replacePageMarkdown, requireEnvVar, withNotionRetry } from 'symbiont-cms/server';
import { Client, type RichTextItemResponse } from '@notionhq/client';
import { INFO_PROPERTY, WHERE_IS_IT_PROPERTY, WHERE_IS_IT_WEB_EDITOR } from '../properties.js';
import { decideContentSource } from '../content-source-decision.js';
import { hasEditLink, infoWithEditLink, placeholderBody } from '$lib/server/web-editor';
import { editLinkForPage, newShareToken, shareUrl, storeShareLinks } from '$lib/server/share-links';

export type ContentSource = 'web' | 'notion';

/** What the Notion page says now. Forgiving of case, like the other readers. */
export function readContentSource(ctx: Pick<HookContext, 'page'>): ContentSource {
  const value = getPropertyNamedValue(ctx.page.properties[WHERE_IS_IT_PROPERTY]);
  return typeof value === 'string' && value.trim().toLowerCase() === WHERE_IS_IT_WEB_EDITOR.toLowerCase()
    ? 'web'
    : 'notion';
}

/*
 * ctx.store keys, set on page:before and read by the later hooks of the same
 * page's sync (sync:result included).
 */
/** The web editor owns the body: skip content. */
const SKIP_CONTENT = 'contentSource:skip';
/** Record meta.contentSource = web for this sync. */
const MARK_WEB = 'contentSource:web';
/** After the save, give the page its web-editor setup. */
const SETUP = 'contentSource:setup';

function info(ctx: HookContext): RichTextItemResponse[] | undefined {
  const property = ctx.page.properties[INFO_PROPERTY] as { type?: string; rich_text?: RichTextItemResponse[] };
  return property?.type === 'rich_text' ? property.rich_text : undefined;
}

/**
 * The sync's service-role client, loosely typed: it is typed with symbiont's
 * own schema, which does not know the app's share_links table.
 */
function db(ctx: HookContext): any {
  return ctx.services.supabase;
}

function notionClient(): Client {
  return new Client({ auth: requireEnvVar('NOTION_TOKEN') });
}

async function readRow(ctx: HookContext) {
  const { data, error } = await db(ctx).from('pages').select('meta, content').eq('page_id', ctx.page.id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as { meta: Record<string, unknown> | null; content: string | null } | null;
}

export const contentSourceChangeHook: Hook<void> = {
  name: 'tech:content-source:change',
  event: 'page:before',
  fn: async (ctx: HookContext) => {
    const now = readContentSource(ctx);
    if (!db(ctx)) {
      // Cannot see the stored state: the only safe assumption for a web page is
      // that its body must not be read.
      if (now === 'web') ctx.store[SKIP_CONTENT] = ctx.store[MARK_WEB] = true;
      return;
    }

    let row;
    try {
      row = await readRow(ctx);
    } catch (error) {
      ctx.logger.warn({
        event: 'content_source_state_unknown',
        pageId: ctx.page.id,
        error: error instanceof Error ? error.message : String(error),
      });
      // Hold whatever could be the real text: never read Notion over it.
      ctx.store[SKIP_CONTENT] = ctx.store[MARK_WEB] = true;
      return;
    }
    const decision = decideContentSource({
      nowWeb: now === 'web',
      rowExists: Boolean(row),
      wasWeb: row?.meta?.contentSource === 'web',
      linked: hasEditLink(info(ctx)),
    });
    if (decision.skipContent) ctx.store[SKIP_CONTENT] = true;
    if (decision.markWeb) ctx.store[MARK_WEB] = true;
    if (decision.setup) ctx.store[SETUP] = true;
    if (decision.setup && !decision.skipContent) ctx.logger.info({ event: 'content_take_in', pageId: ctx.page.id });
    if (!decision.handoff) return;

    // Handoff: Notion owns it now, and the web editor did last time.
    const body = typeof row?.content === 'string' ? row.content : '';
    if (!body.trim()) {
      ctx.logger.info({ event: 'content_handoff_empty', pageId: ctx.page.id });
      return;
    }
    try {
      await replacePageMarkdown(notionClient(), ctx.page.id, body);
      ctx.logger.info({ event: 'content_handoff_done', pageId: ctx.page.id });
    } catch (handoffError) {
      ctx.store[SKIP_CONTENT] = ctx.store[MARK_WEB] = true;
      ctx.logger.error({
        event: 'content_handoff_failed',
        pageId: ctx.page.id,
        error: handoffError instanceof Error ? handoffError.message : String(handoffError),
      });
    }
  },
};

/**
 * meta.contentSource for this sync, or null. NOT registered as a metadata:add
 * hook: the app fills symbiont's `addMetadata` slot, and symbiont refuses a
 * config with both a slot and a hook for the same event (it throws before any
 * page is processed -- which took every article sync down once). The slot
 * function in symbiont.server.ts merges this in instead.
 */
export function contentSourceMetadata(ctx: HookContext): Record<string, unknown> | null {
  return ctx.store[MARK_WEB] ? { contentSource: 'web' } : null;
}

export const contentSourceShouldSyncHook: Hook<boolean> = {
  name: 'tech:content-source:should-sync',
  event: 'content:should-sync',
  // null abstains (sync as usual); false is the only vote that matters.
  fn: async (ctx: HookContext) => (ctx.store[SKIP_CONTENT] ? false : null),
};

/**
 * The web-editor setup, after the row is saved: the article's edit link (the
 * one it already has -- so a hand-back re-opens the writer's own link -- or a
 * new one), the placeholder body pointing to it, and the Info line.
 *
 * The Info line is rewritten every time, not only for a new link: it is an
 * idempotent replace of one tagged line, and it repairs a line an editor
 * deleted or mangled.
 */
export const contentSourceSetupHook: Hook<void> = {
  name: 'tech:content-source:setup',
  event: 'sync:result',
  continueOnError: true,
  fn: async (ctx: HookContext) => {
    const report = ctx.input as SyncResultReport | undefined;
    // Only once the text is safely in the database.
    if (!ctx.store[SETUP] || !report?.ok) return;

    let token = await editLinkForPage(ctx.page.id, db(ctx));
    const newLink = !token;
    if (!token) {
      token = newShareToken();
      await storeShareLinks(ctx.page.id, [{ token, readOnly: false }], db(ctx));
    }
    const editUrl = shareUrl(token);

    const notion = notionClient();
    await replacePageMarkdown(notion, ctx.page.id, placeholderBody(editUrl));
    await withNotionRetry(() =>
      notion.pages.update({
        page_id: ctx.page.id,
        properties: { [INFO_PROPERTY]: { rich_text: infoWithEditLink(info(ctx) ?? [], editUrl) } },
      } as Parameters<Client['pages']['update']>[0]),
    );
    ctx.logger.info({ event: 'web_editor_setup_done', pageId: ctx.page.id, newEditLink: newLink });
  },
};

/** For the `hooks` array. The metadata half is contentSourceMetadata, above. */
export const contentSourceHooks: Hook[] = [
  contentSourceChangeHook,
  contentSourceShouldSyncHook,
  contentSourceSetupHook,
];

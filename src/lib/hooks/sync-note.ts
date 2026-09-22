/**
 * The Tech-specific half of sync reporting.
 *
 * Symbiont knows a sync happened and whether it worked. It does not know that
 * this newsroom keeps a column called Info, writes times in Pacific, or tags
 * machine output with `[sync]`. Those are editorial conventions, so they live
 * here. What symbiont supplies is the part that is the same everywhere: a safe
 * rich_text round-trip, rate-limit retry, and the self-edit detection that
 * keeps a write-back from triggering itself forever.
 */
import type { Hook, HookContext, SyncResultReport } from 'symbiont-cms';
import { appendOrReplaceTaggedLine } from 'symbiont-cms/server';
import { SYNC_NOTE_PROPERTY as NOTES_PROPERTY_NAME } from '$lib/notion-properties';

/** Prefix that marks the line as machine-written, so the next run replaces it. */
const SYNC_NOTE_TAG = '[sync]';
/** The newsroom's clock. The timestamp exists to answer "is this current?". */
const NEWSROOM_TIME_ZONE = 'America/Los_Angeles';

/** Keeps a stack trace from crowding out an editor's own notes. */
const MAX_MESSAGE_LENGTH = 300;

function truncate(value: string, limit: number): string {
  const collapsed = value.replace(/\s+/g, ' ').trim();
  return collapsed.length <= limit ? collapsed : `${collapsed.slice(0, limit - 1)}…`;
}

export function formatSyncNote(report: SyncResultReport): string {
  const stamp = new Intl.DateTimeFormat('en-CA', {
    timeZone: NEWSROOM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(report.at);

  const outcome = report.ok
    ? 'synced'
    : `FAILED — ${truncate(report.error?.message ?? 'unknown error', MAX_MESSAGE_LENGTH)}`;

  return `${SYNC_NOTE_TAG} ${stamp} PT — ${outcome}`;
}

export const syncNoteHooks: Hook[] = [
  {
    name: 'tech:sync-note',
    event: 'sync:result',
    // Reporting must never be the thing that fails a sync that otherwise worked.
    continueOnError: true,
    fn: async (ctx: HookContext) => {
      const report = ctx.input as SyncResultReport | undefined;
      if (!report) return null;

      /*
       * Not optional. A write-back edits the page, which fires the automation,
       * which runs this sync, which writes back. writeBackSafe is false both
       * when the last edit was ours and when symbiont could not determine whose
       * it was -- "unknown" has to count as unsafe or the loop is unbounded.
       */
      if (!report.writeBackSafe) return null;

      /*
       * Nothing happened, so say nothing. Rewriting an identical line on every
       * webhook would mean a Notion write per event for no information, and
       * each of those writes is itself an edit.
       */
      if (report.ok && report.unchanged) return null;

      const property = ctx.page.properties[NOTES_PROPERTY_NAME];
      if (!property || property.type !== 'rich_text') {
        ctx.logger.warn({
          event: 'sync_note_property_unusable',
          pageId: ctx.page.id,
          propertyName: NOTES_PROPERTY_NAME,
          actualType: property?.type ?? 'missing',
        });
        return null;
      }

      const items = appendOrReplaceTaggedLine(property.rich_text, formatSyncNote(report), {
        tag: SYNC_NOTE_TAG,
        color: report.ok ? 'gray' : 'red',
      });

      await ctx.services.notionClient?.updateRichTextProperty(ctx.page.id, NOTES_PROPERTY_NAME, items);

      return null;
    },
  },
];

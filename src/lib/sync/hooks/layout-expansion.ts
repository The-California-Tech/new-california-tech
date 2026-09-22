/**
 * Keeping Notion's `Layout` preset and its granular columns in step.
 *
 * Choosing a preset fills the granular columns in, so an editor can see what it
 * meant and change any single part. Changing a part clears the preset. Choosing
 * a *different* preset re-applies it over whatever is there.
 *
 * Telling those last two apart needs one bit of history, which is what the
 * `Layout Applied` column holds.
 *
 * Two files, split by what they touch: the decision is pure and lives in
 * sync/reconcile-layout.ts, where it can be tested without a Notion
 * account; this one reads and writes properties and does nothing else.
 */
import type { Hook, HookContext, SyncResultReport } from 'symbiont-cms';
import {
  normalizeBylineFormat,
  normalizeCoverPlacement,
  normalizeCoverStyle,
  normalizeLayoutPreset,
  normalizeProminence,
} from '$lib/utils/layout-preset';
import {
  BYLINE_PROPERTY,
  LAYOUT_APPLIED_PROPERTY,
  COVER_PLACEMENT_PROPERTY,
  COVER_STYLE_PROPERTY,
  HIDE_SUMMARY_PROPERTY,
  LAYOUT_PROPERTY,
  PROMINENCE_PROPERTY,
} from '$lib/sync/properties';
import { reconcileLayout, type GranularLayout } from '$lib/sync/reconcile-layout';

/** Internal value -> the label an editor sees in the select. */
const PROMINENCE_LABELS: Record<string, string> = {
  lead: 'Lead',
  feature: 'Feature',
  standard: 'Standard',
  brief: 'Brief',
};
const COVER_PLACEMENT_LABELS: Record<string, string> = { stacked: 'Stacked', sidebar: 'Sidebar' };
const BYLINE_LABELS: Record<string, string> = { stacked: 'Stacked', inline: 'One line' };
const COVER_STYLE_LABELS: Record<string, string> = { TOP: 'Top', NONE: 'None' };

function selectName(property: unknown): string | null {
  const prop = property as { type?: string; select?: { name?: string } | null } | undefined;
  return prop?.type === 'select' ? (prop.select?.name ?? null) : null;
}

/** Concatenated plain text of a rich_text property, or null when empty. */
function richText(property: unknown): string | null {
  const prop = property as { type?: string; rich_text?: Array<{ plain_text?: string }> } | undefined;
  if (prop?.type !== 'rich_text') return null;
  const text = (prop.rich_text ?? [])
    .map((item) => item.plain_text ?? '')
    .join('')
    .trim();
  return text || null;
}

function checkbox(property: unknown): boolean {
  const prop = property as { type?: string; checkbox?: boolean } | undefined;
  return prop?.type === 'checkbox' && typeof prop.checkbox === 'boolean' ? prop.checkbox : false;
}

function readGranular(properties: Record<string, unknown>): GranularLayout {
  return {
    prominence: normalizeProminence(selectName(properties[PROMINENCE_PROPERTY])),
    coverPlacement: normalizeCoverPlacement(selectName(properties[COVER_PLACEMENT_PROPERTY])),
    bylineFormat: normalizeBylineFormat(selectName(properties[BYLINE_PROPERTY])),
    coverStyle: normalizeCoverStyle(selectName(properties[COVER_STYLE_PROPERTY])),
    hideSummary: checkbox(properties[HIDE_SUMMARY_PROPERTY]),
  };
}

export const layoutExpansionHooks: Hook[] = [
  {
    name: 'tech:layout-expansion',
    event: 'sync:result',
    // Editorial convenience. It must never be the reason a sync fails.
    continueOnError: true,
    fn: async (ctx: HookContext) => {
      const report = ctx.input as SyncResultReport | undefined;
      if (!report) return null;

      /*
       * Not optional. Every branch below writes to the page, and a write fires
       * the automation that runs this sync. writeBackSafe is false both when
       * the last edit was ours and when symbiont could not tell -- "unknown"
       * has to count as unsafe or the loop is unbounded.
       */
      if (!report.writeBackSafe) return null;

      const notionClient = ctx.services.notionClient;
      if (!notionClient) return null;

      /*
       * Degrades rather than throwing on a symbiont older than the release that
       * added this. The method is reached through an `any`, so nothing else
       * would catch its absence until it failed at runtime in production.
       */
      if (typeof notionClient.updatePageProperties !== 'function') {
        ctx.logger.warn({
          event: 'layout_expansion_unavailable',
          hint: 'symbiont-cms needs updatePageProperties (added after v1.2.2).',
        });
        return null;
      }

      const properties = ctx.page.properties as Record<string, unknown>;
      const preset = normalizeLayoutPreset(selectName(properties[LAYOUT_PROPERTY]));
      const applied = normalizeLayoutPreset(richText(properties[LAYOUT_APPLIED_PROPERTY]));
      const decision = reconcileLayout(preset, applied, readGranular(properties));

      if (decision.action === 'none') return null;

      if (decision.action === 'forget-applied') {
        ctx.logger.info({ event: 'layout_applied_forgotten', pageId: ctx.page.id, applied });
        await notionClient.updatePageProperties(ctx.page.id, {
          [LAYOUT_APPLIED_PROPERTY]: { rich_text: [] },
        });
        return null;
      }

      if (decision.action === 'clear-preset') {
        ctx.logger.info({
          event: 'layout_preset_cleared',
          pageId: ctx.page.id,
          preset,
          conflicts: decision.conflicts,
        });
        // Both, or the next sync reads the stale memory as a fresh choice.
        await notionClient.updatePageProperties(ctx.page.id, {
          [LAYOUT_PROPERTY]: { select: null },
          [LAYOUT_APPLIED_PROPERTY]: { rich_text: [] },
        });
        return null;
      }

      const { values } = decision;
      ctx.logger.info({
        event: 'layout_preset_applied',
        pageId: ctx.page.id,
        preset: decision.preset,
        previouslyApplied: applied,
      });

      // One request, not six: the limit is expressed in requests per second.
      await notionClient.updatePageProperties(ctx.page.id, {
        [PROMINENCE_PROPERTY]: { select: { name: PROMINENCE_LABELS[values.prominence!] } },
        [COVER_PLACEMENT_PROPERTY]: {
          select: { name: COVER_PLACEMENT_LABELS[values.coverPlacement!] },
        },
        [BYLINE_PROPERTY]: { select: { name: BYLINE_LABELS[values.bylineFormat!] } },
        [COVER_STYLE_PROPERTY]: { select: { name: COVER_STYLE_LABELS[values.coverStyle!] } },
        [HIDE_SUMMARY_PROPERTY]: { checkbox: values.hideSummary },
        // The memory, written in the same request so it cannot drift from the
        // values it describes.
        [LAYOUT_APPLIED_PROPERTY]: {
          rich_text: [{ type: 'text', text: { content: decision.preset } }],
        },
      });

      return null;
    },
  },
];

/**
 * Keeping Notion's `Layout` preset and its granular columns in step.
 *
 * Choosing a preset fills the granular columns in, so an editor can see what it
 * meant and change any single part. Changing a part clears the preset, because
 * the granular columns are the source of truth and a preset that disagrees with
 * them is simply stale. The decision itself lives in utils/layout-expansion.ts
 * and is pure; this file is the Notion plumbing around it.
 */
import type { Hook, HookContext, SyncResultReport } from 'symbiont-cms';
import {
  normalizeBylineFormat,
  normalizeCoverPlacement,
  normalizeLayoutPreset,
  normalizeProminence,
} from '$lib/utils/layout-preset';
import { reconcileLayout, type GranularLayout } from '$lib/utils/layout-expansion';

const LAYOUT_PROPERTY_NAME = 'Layout';
const PROMINENCE_PROPERTY_NAME = 'Prominence';
const COVER_PLACEMENT_PROPERTY_NAME = 'Cover Placement';
const BYLINE_PROPERTY_NAME = 'Byline';
const COVER_STYLE_PROPERTY_NAME = 'Cover Photo Style';
const HIDE_SUMMARY_PROPERTY_NAME = 'Hide Summary';

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

function checkbox(property: unknown): boolean {
  const prop = property as { type?: string; checkbox?: boolean } | undefined;
  return prop?.type === 'checkbox' && typeof prop.checkbox === 'boolean' ? prop.checkbox : false;
}

/** 'Top'/'Above' -> 'TOP'. Mirrors the reader in tech-hooks. */
function normalizeCoverStyleValue(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'none') return 'NONE';
  if (normalized === 'top' || normalized === 'above') return 'TOP';
  return null;
}

function readGranular(properties: Record<string, unknown>): GranularLayout {
  return {
    prominence: normalizeProminence(selectName(properties[PROMINENCE_PROPERTY_NAME])),
    coverPlacement: normalizeCoverPlacement(selectName(properties[COVER_PLACEMENT_PROPERTY_NAME])),
    bylineFormat: normalizeBylineFormat(selectName(properties[BYLINE_PROPERTY_NAME])),
    coverStyle: normalizeCoverStyleValue(selectName(properties[COVER_STYLE_PROPERTY_NAME])),
    hideSummary: checkbox(properties[HIDE_SUMMARY_PROPERTY_NAME]),
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
      const preset = normalizeLayoutPreset(selectName(properties[LAYOUT_PROPERTY_NAME]));
      const decision = reconcileLayout(preset, readGranular(properties));

      if (decision.action === 'none') return null;

      if (decision.action === 'clear-preset') {
        ctx.logger.info({
          event: 'layout_preset_cleared',
          pageId: ctx.page.id,
          preset,
          conflicts: decision.conflicts,
        });
        await notionClient.updatePageProperties(ctx.page.id, {
          [LAYOUT_PROPERTY_NAME]: { select: null },
        });
        return null;
      }

      const { values } = decision;
      ctx.logger.info({ event: 'layout_preset_applied', pageId: ctx.page.id, preset });

      // One request, not five: the limit is expressed in requests per second.
      await notionClient.updatePageProperties(ctx.page.id, {
        [PROMINENCE_PROPERTY_NAME]: { select: { name: PROMINENCE_LABELS[values.prominence!] } },
        [COVER_PLACEMENT_PROPERTY_NAME]: {
          select: { name: COVER_PLACEMENT_LABELS[values.coverPlacement!] },
        },
        [BYLINE_PROPERTY_NAME]: { select: { name: BYLINE_LABELS[values.bylineFormat!] } },
        [COVER_STYLE_PROPERTY_NAME]: { select: { name: COVER_STYLE_LABELS[values.coverStyle!] } },
        [HIDE_SUMMARY_PROPERTY_NAME]: { checkbox: values.hideSummary },
      });

      return null;
    },
  },
];

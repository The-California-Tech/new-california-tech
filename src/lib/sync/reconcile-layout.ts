import { resolveLayoutRecipe, type LayoutPreset } from '$lib/utils/layout-preset';
import {
  BYLINE_PROPERTY,
  COVER_PLACEMENT_PROPERTY,
  COVER_STYLE_PROPERTY,
  HIDE_SUMMARY_PROPERTY,
  PROMINENCE_PROPERTY,
} from '$lib/sync/properties';

/**
 * Reconciling the `Layout` preset with the granular columns it expands into.
 *
 * Both directions work, and that is what `Layout Applied` buys. It records the
 * preset as of our last write, which is the one thing Notion will not tell us:
 * when `Layout` and the granular columns disagree, *which of them did the
 * editor touch?* Page history is per-page, not per-property, and comparing the
 * granular values against every preset's expansion does not disambiguate either
 * -- seven of the eight presets differ from another by exactly one field, so
 * the commonest single edit (bumping Prominence) produces an exact match for a
 * different preset.
 *
 * With that one bit of memory:
 *
 *   Layout != Applied          the editor chose a preset -- apply it, even over
 *                              existing granular values. Choosing a preset is an
 *                              explicit instruction to use that recipe.
 *   Layout == Applied, but a   the editor changed a granular control -- the
 *   granular value disagrees   preset is stale, so clear both.
 *   Layout cleared by hand     forget Applied too, so the next sync does not
 *                              read the stale value as a fresh choice.
 *
 * If an editor changes the preset AND a granular control between two syncs, the
 * preset wins. It is the more deliberate act, and there is no ordering
 * information to do better with.
 */

/** The granular columns, in the app's vocabulary rather than Notion's. */
export interface GranularLayout {
  prominence: string | null;
  coverPlacement: string | null;
  bylineFormat: string | null;
  /** 'TOP' | 'NONE', or null when the column is blank. */
  coverStyle: string | null;
  /** A checkbox, so never blank -- false is a real answer, not "unset". */
  hideSummary: boolean;
}

export type LayoutReconciliation =
  | { action: 'none'; reason: string }
  /** Write the expansion, and record the preset as applied. */
  | { action: 'apply'; preset: LayoutPreset; values: GranularLayout }
  /** A granular control was changed: clear both Layout and Layout Applied. */
  | { action: 'clear-preset'; conflicts: string[] }
  /** Layout was cleared by hand; drop the stale memory of it. */
  | { action: 'forget-applied'; reason: string };

/** What the preset says every granular column should be. */
export function expandPreset(preset: LayoutPreset): GranularLayout {
  const recipe = resolveLayoutRecipe(preset);
  return {
    prominence: recipe.prominence,
    coverPlacement: recipe.coverPlacement,
    bylineFormat: recipe.bylineFormat,
    coverStyle: recipe.cover ? 'TOP' : 'NONE',
    hideSummary: !recipe.summary,
  };
}

export function reconcileLayout(
  preset: LayoutPreset | null,
  applied: LayoutPreset | null,
  current: GranularLayout,
): LayoutReconciliation {
  if (!preset) {
    return applied
      ? { action: 'forget-applied', reason: 'the Layout select was cleared by hand' }
      : { action: 'none', reason: 'no preset set' };
  }

  if (preset !== applied) {
    // The preset moved. That is an instruction, so it overrides whatever the
    // granular columns currently say.
    return { action: 'apply', preset, values: expandPreset(preset) };
  }

  /*
   * From here the preset is exactly what we last applied, so it did not move --
   * which means any disagreement is an edit to a granular control.
   */
  const target = expandPreset(preset);

  const conflicts: string[] = [];
  if (current.prominence && current.prominence !== target.prominence) conflicts.push(PROMINENCE_PROPERTY);
  if (current.coverPlacement && current.coverPlacement !== target.coverPlacement) {
    conflicts.push(COVER_PLACEMENT_PROPERTY);
  }
  if (current.bylineFormat && current.bylineFormat !== target.bylineFormat) conflicts.push(BYLINE_PROPERTY);
  if (current.coverStyle && current.coverStyle !== target.coverStyle) conflicts.push(COVER_STYLE_PROPERTY);
  /*
   * The checkbox has no blank state, but `applied` being set means this row has
   * definitely been expanded, so an unticked box is now a real answer rather
   * than "nobody has said".
   */
  if (current.hideSummary !== target.hideSummary) conflicts.push(HIDE_SUMMARY_PROPERTY);

  if (conflicts.length > 0) {
    return { action: 'clear-preset', conflicts };
  }

  const hasBlanks = !current.prominence || !current.coverPlacement || !current.bylineFormat || !current.coverStyle;
  if (hasBlanks) {
    return { action: 'apply', preset, values: target };
  }

  return { action: 'none', reason: 'granular columns already match the preset' };
}

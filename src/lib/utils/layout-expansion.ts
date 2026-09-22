import { resolveLayoutRecipe, type LayoutPreset } from '$lib/utils/layout-preset';
import {
  BYLINE_PROPERTY,
  COVER_PLACEMENT_PROPERTY,
  COVER_STYLE_PROPERTY,
  HIDE_SUMMARY_PROPERTY,
  PROMINENCE_PROPERTY,
} from '$lib/notion-properties';

/**
 * Reconciling the `Layout` preset with the granular columns it expands into.
 *
 * The rule, in one line: **the granular columns win.**
 *
 * `Layout` is a recipe, not a setting. Choosing one fills the granular columns
 * in, so an editor can see what the preset actually meant and adjust any single
 * part of it. The moment one of those parts disagrees with the preset, the
 * preset is the thing that is wrong -- it gets cleared, and the granular values
 * stand on their own.
 *
 * That ordering is what makes this stateless. If the *preset* won, we would
 * need to remember which of the two changed since the last sync, and Notion
 * offers no per-property history to find out. Because the granular columns win,
 * the current values are the whole story.
 *
 * The consequence to know about: once a row has been expanded, picking a
 * different preset does not re-apply it -- the new preset disagrees with the
 * existing granular values, so it clears itself. To re-apply, clear the
 * granular columns and then pick the preset.
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
  /** Fill the blank granular columns from the preset. */
  | { action: 'apply'; values: GranularLayout }
  /** A granular column disagrees; the preset is stale and must go. */
  | { action: 'clear-preset'; conflicts: string[] };

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

export function reconcileLayout(preset: LayoutPreset | null, current: GranularLayout): LayoutReconciliation {
  if (!preset) {
    return { action: 'none', reason: 'no preset set' };
  }

  const target = expandPreset(preset);

  /*
   * Conflicts are judged on *filled* columns only. A blank column has not been
   * disagreed with; it has not been answered. Checking conflicts before
   * blankness matters: a row where somebody changed one value and left another
   * empty must not have the changed one overwritten just because a neighbour
   * happens to be blank.
   */
  const conflicts: string[] = [];
  if (current.prominence && current.prominence !== target.prominence) conflicts.push(PROMINENCE_PROPERTY);
  if (current.coverPlacement && current.coverPlacement !== target.coverPlacement) {
    conflicts.push(COVER_PLACEMENT_PROPERTY);
  }
  if (current.bylineFormat && current.bylineFormat !== target.bylineFormat) conflicts.push(BYLINE_PROPERTY);
  if (current.coverStyle && current.coverStyle !== target.coverStyle) conflicts.push(COVER_STYLE_PROPERTY);

  /*
   * The checkbox has no blank state, so it can only be compared once the row
   * has been expanded at all. Before that, an unticked box means "nobody has
   * said" rather than "show the summary", and treating it as a conflict would
   * clear the preset before it was ever applied.
   */
  const everExpanded = Boolean(
    current.prominence || current.coverPlacement || current.bylineFormat || current.coverStyle,
  );
  if (everExpanded && current.hideSummary !== target.hideSummary) conflicts.push(HIDE_SUMMARY_PROPERTY);

  if (conflicts.length > 0) {
    return { action: 'clear-preset', conflicts };
  }

  const hasBlanks = !current.prominence || !current.coverPlacement || !current.bylineFormat || !current.coverStyle;
  if (hasBlanks || current.hideSummary !== target.hideSummary) {
    return { action: 'apply', values: target };
  }

  return { action: 'none', reason: 'granular columns already match the preset' };
}

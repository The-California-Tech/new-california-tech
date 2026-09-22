/**
 * The names of the Notion columns this app reads and writes.
 *
 * One definition each, because they were previously declared separately in
 * hooks/tech.ts and hooks/layout-expansion.ts and immediately drifted: renaming
 * `Byline` to `Byline Layout` in one file left the other reading a column that
 * no longer existed, which fails silently -- a missing property reads as blank,
 * and blank is a legitimate value everywhere here.
 *
 * Anything that names a column should import it from here.
 */

// ── the Layout preset and the granular controls it expands into ───────────
export const LAYOUT_PROPERTY = 'Layout';
export const PROMINENCE_PROPERTY = 'Prominence';
export const COVER_PLACEMENT_PROPERTY = 'Cover Placement';
export const BYLINE_PROPERTY = 'Byline Layout';
export const COVER_STYLE_PROPERTY = 'Cover Photo Style';
export const HIDE_SUMMARY_PROPERTY = 'Hide Summary';

/**
 * rich_text, machine-owned, hide it in your views.
 *
 * Holds the preset as of the last time this app expanded it, which is the one
 * bit of history Notion will not give us: without it, a disagreement between
 * `Layout` and the granular columns cannot be attributed to whichever of them
 * the editor actually touched.
 *
 * rich_text rather than a second select, so there are no options to keep in
 * step with `Layout` and no risk of the API inventing one. It stores the
 * internal slug (`lead-photo-first`), not the editor-facing label.
 */
export const LAYOUT_APPLIED_PROPERTY = 'Layout Applied';

/** Not preset-derived: taken from the image unless overridden. */
export const COVER_FIT_PROPERTY = 'Cover Fit';

/** Ordering within an issue. Independent of everything above. */
export const LAYOUT_WEIGHT_PROPERTY = 'Layout Weight';

/**
 * rich_text, machine-owned. The sync writes one tagged status line here.
 *
 * Was `Info`, a column editors also wrote in -- which is why the writer splices
 * a single `[sync]`-tagged line rather than overwriting. That care is no longer
 * strictly needed now the column is ours alone, but it is kept: it costs
 * nothing, and it means anything a person does type here survives.
 */
export const SYNC_NOTE_PROPERTY = 'Sync Status';

/**
 * The granular columns, in the order they are reported in conflict logs.
 * Used to keep those messages naming what an editor actually sees.
 */
export const GRANULAR_LAYOUT_PROPERTIES = [
  PROMINENCE_PROPERTY,
  COVER_PLACEMENT_PROPERTY,
  BYLINE_PROPERTY,
  COVER_STYLE_PROPERTY,
  HIDE_SUMMARY_PROPERTY,
] as const;

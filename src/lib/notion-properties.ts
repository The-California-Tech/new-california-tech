/**
 * The names of the Notion columns this app reads and writes.
 *
 * One definition each, because they were previously declared separately in
 * tech-hooks.ts and layout-expansion.ts and immediately drifted: renaming
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

/** Not preset-derived: taken from the image unless overridden. */
export const COVER_FIT_PROPERTY = 'Cover Fit';

/** Ordering within an issue. Independent of everything above. */
export const LAYOUT_WEIGHT_PROPERTY = 'Layout Weight';

/** rich_text. The sync appends one tagged status line to the end of it. */
export const SYNC_NOTE_PROPERTY = 'Info';

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

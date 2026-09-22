/**
 * The front-page layout vocabulary.
 *
 * One Notion property (`Layout`) picks a preset; this table expands it into the
 * three things the renderer actually needs. Editors get one control named for
 * what they are trying to say; the code keeps the dimensions separable.
 *
 * The presets deliberately do not name widths. "3 column width" is a desktop
 * instruction -- on a phone there are no three columns, so every such option
 * would need a mobile translation invented somewhere else, which means the
 * property was never the real source of truth. `prominence` is editorial
 * intent, and the grid maps it to columns and rows separately at each
 * breakpoint. "Lead" means something at 375px; "full page width" does not.
 */

/** How much the story matters today. The grid turns this into area. */
export type Prominence = 'lead' | 'feature' | 'standard' | 'brief';

/** Where the cover sits relative to the text, when there is one. */
export type CoverPlacement = 'stacked' | 'sidebar';

export type BylineFormat = 'stacked' | 'inline';

export type LayoutPreset =
  'lead' | 'lead-photo-first' | 'lead-photo' | 'feature' | 'standard' | 'standard-text' | 'brief' | 'headline';

export interface LayoutRecipe {
  prominence: Prominence;
  coverPlacement: CoverPlacement;
  /** One line, or author and category stacked. Always within a column. */
  bylineFormat: BylineFormat;
  /** Default only. `Cover Photo Style` still overrides it. */
  cover: boolean;
  /** Default only. `Hide Summary` still overrides it. */
  summary: boolean;
}

export const DEFAULT_LAYOUT_PRESET: LayoutPreset = 'standard';

/**
 * Notion labels, in the order they should appear in the select:
 *
 *   Lead               | Lead - Photo First | Lead - Photo | Feature
 *   Standard           | Standard - Text    | Brief        | Headline
 */
export const LAYOUT_PRESETS: Record<LayoutPreset, LayoutRecipe> = {
  // Full row. Banner headline across the top, photo in the outer column, byline
  // and summary running in newspaper columns beside it.
  lead: {
    prominence: 'lead',
    coverPlacement: 'sidebar',
    bylineFormat: 'stacked',
    cover: true,
    summary: true,
  },
  // Full row, but the photo leads and everything stacks under it.
  'lead-photo-first': {
    prominence: 'lead',
    coverPlacement: 'stacked',
    bylineFormat: 'stacked',
    cover: true,
    summary: true,
  },
  // Full row, photo and headline, no prose. The picture is the story, so the
  // byline stays a centred band -- there are no columns for it to sit in.
  'lead-photo': {
    prominence: 'lead',
    coverPlacement: 'stacked',
    bylineFormat: 'inline',
    cover: true,
    summary: false,
  },

  feature: {
    prominence: 'feature',
    coverPlacement: 'stacked',
    bylineFormat: 'stacked',
    cover: true,
    summary: true,
  },

  standard: {
    prominence: 'standard',
    coverPlacement: 'stacked',
    bylineFormat: 'stacked',
    cover: true,
    summary: true,
  },
  'standard-text': {
    prominence: 'standard',
    coverPlacement: 'stacked',
    bylineFormat: 'stacked',
    cover: false,
    summary: true,
  },

  brief: {
    prominence: 'brief',
    coverPlacement: 'stacked',
    bylineFormat: 'inline',
    cover: true,
    summary: false,
  },
  headline: {
    prominence: 'brief',
    coverPlacement: 'stacked',
    bylineFormat: 'inline',
    cover: false,
    summary: false,
  },
};

/**
 * Accepts the Notion label in any casing or punctuation, plus the names this
 * property has had before, so a datasource part-way through the migration keeps
 * rendering. `compact` was the original name for `brief`; `title`/`title-cover`
 * were a short-lived attempt to express headline-only cards as sizes.
 */
export function normalizeLayoutPreset(value: unknown): LayoutPreset | null {
  const normalized = slug(value);
  if (!normalized) return null;
  if (normalized in LAYOUT_PRESETS) return normalized as LayoutPreset;

  switch (normalized) {
    case 'lead-photo-top':
    case 'lead-photo-then-headline':
      return 'lead-photo-first';
    case 'compact':
    case 'title-cover':
    case 'title-and-cover':
      return 'brief';
    case 'title':
    case 'title-only':
      return 'headline';
    case 'text':
    case 'text-only':
      return 'standard-text';
    default:
      return null;
  }
}

function slug(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || null;
}

const BYLINE_FORMATS: readonly BylineFormat[] = ['stacked', 'inline'];

/**
 * The `Byline` property.
 *
 * This column exists so the granular controls *fully* determine the layout.
 * They take precedence over the preset, and the preset is cleared when they
 * disagree with it -- which only works if every dimension the preset carries
 * has somewhere to live. Without this one, clearing a `Brief` would silently
 * revert its byline from one line to two.
 */
export function normalizeBylineFormat(value: unknown): BylineFormat | null {
  const normalized = slug(value);
  if (!normalized) return null;
  if ((BYLINE_FORMATS as readonly string[]).includes(normalized)) return normalized as BylineFormat;
  switch (normalized) {
    case 'one-line':
    case 'single-line':
    case 'oneline':
      return 'inline';
    case 'two-line':
    case 'separate-lines':
      return 'stacked';
    default:
      return null;
  }
}

const PROMINENCES: readonly Prominence[] = ['lead', 'feature', 'standard', 'brief'];
const COVER_PLACEMENTS: readonly CoverPlacement[] = ['stacked', 'sidebar'];

/**
 * The escape hatch for one dimension of the preset.
 *
 * Normally blank. It exists for "Feature, but only as tall as a Standard
 * today" -- the case where the preset is the right description of the card and
 * the wrong amount of space.
 */
export function normalizeProminence(value: unknown): Prominence | null {
  const normalized = slug(value);
  if (!normalized) return null;
  if ((PROMINENCES as readonly string[]).includes(normalized)) return normalized as Prominence;
  // The size vocabulary this replaced, so old values keep meaning something.
  if (normalized === 'compact') return 'brief';
  return null;
}

/** As above, for the arrangement rather than the area. */
export function normalizeCoverPlacement(value: unknown): CoverPlacement | null {
  const normalized = slug(value);
  if (!normalized) return null;
  if ((COVER_PLACEMENTS as readonly string[]).includes(normalized)) return normalized as CoverPlacement;
  switch (normalized) {
    case 'aside':
    case 'side':
    case 'beside':
    case 'right':
    case 'right-column':
      return 'sidebar';
    case 'above':
    case 'top':
      return 'stacked';
    default:
      return null;
  }
}

/**
 * Whether the cover fills its frame or fits inside it.
 *
 * `fill` crops to the frame (object-fit: cover). `contain` keeps the whole
 * picture and accepts empty space beside it.
 */
export type CoverFit = 'contain' | 'fill';

const COVER_FITS: readonly CoverFit[] = ['contain', 'fill'];

/**
 * Never crop unless asked.
 *
 * This used to return `fill` for anything landscape, on the theory that a wide
 * photo fills a wide frame with almost nothing lost. "Almost nothing" is still
 * something, and it is the photographer's something: the frame's height is set
 * by the card, not by the picture, so how much came off the top and bottom was
 * whatever the layout happened to need that day.
 *
 * `contain` with the frame carrying the image's own aspect-ratio means a
 * landscape cover fills its frame exactly anyway -- no crop AND no empty space.
 * The letterboxing only appears when the height cap bites, which is the
 * portrait case, and that is handled by giving portraits a column of their own
 * rather than by cropping them.
 *
 * `fill` remains reachable through the Cover Fit property for the picture that
 * genuinely wants a crop.
 */
export function autoCoverFit(_width?: number | null, _height?: number | null): CoverFit {
  return 'contain';
}

/**
 * A portrait cover gets its own column beside the text, where there is one.
 *
 * Stacked above the text, a tall photo is boxed into a frame whose width is the
 * whole card and whose height is capped, so it ends up small and marooned in
 * the middle with empty space either side. Beside the text it is the right
 * shape for the space -- which is what a newspaper does with a standing
 * portrait.
 *
 * Only where a column is actually available: a `standard` or `brief` card is
 * one grid column wide, so there is no outer column to move the photo into and
 * it stays stacked.
 */
export function autoCoverPlacement(
  width: number | null | undefined,
  height: number | null | undefined,
  prominence: Prominence,
): CoverPlacement {
  if (!width || !height) return 'stacked';
  const roomForAColumn = prominence === 'lead' || prominence === 'feature';
  return width / height < 1 && roomForAColumn ? 'sidebar' : 'stacked';
}

/**
 * The `Cover Fit` property. Blank -- the normal case -- means autoCoverFit
 * decides; a value overrides it for the photo that needs an exception.
 */
export function normalizeCoverFit(value: unknown): CoverFit | null {
  const normalized = slug(value);
  if (!normalized) return null;
  if ((COVER_FITS as readonly string[]).includes(normalized)) return normalized as CoverFit;
  switch (normalized) {
    case 'crop':
    case 'cover':
    case 'full-bleed':
      return 'fill';
    case 'fit':
    case 'whole':
    case 'uncropped':
      return 'contain';
    default:
      return null;
  }
}

/**
 * The `Cover Photo Style` property. 'Behind' was retired -- see the comment on
 * VALID_COVER_STYLES in post-converter.
 */
export function normalizeCoverStyle(value: unknown): 'NONE' | 'TOP' | null {
  const normalized = slug(value);
  if (!normalized) return null;
  if (normalized === 'none') return 'NONE';
  if (normalized === 'top' || normalized === 'above') return 'TOP';
  return null;
}

export function resolveLayoutRecipe(preset: LayoutPreset | null | undefined): LayoutRecipe {
  return LAYOUT_PRESETS[preset ?? DEFAULT_LAYOUT_PRESET];
}

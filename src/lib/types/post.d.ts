import type { TOC } from '$lib/types/toc';
import type { Tags } from '$lib/types/tags';
import type { BylineFormat, CoverFit, CoverPlacement, LayoutPreset, Prominence } from '$lib/utils/layout-preset';
export namespace Post {
  export type Post = {
    slug: string;
    title: string;
    description: string;
    authors?: Array<string>;
    summary?: string;
    /** Pre-rendered HTML from summary markdown */
    summary_html?: string;
    content?: string;
    html?: string;
    published: string;
    updated: string;
    created: string;
    cover?: string;
    coverWidth?: number;
    coverHeight?: number;
    thumbnail?: string;
    coverInPost?: boolean;
    coverCaption?: string;
    coverStyle: CoverStyle;
    /** The `Layout` property as chosen, kept for debugging and data-attrs. */
    layoutPreset?: LayoutPreset;
    /** Expanded from the preset. How much area the grid gives this story. */
    prominence?: Prominence;
    /** Expanded from the preset. Where the cover sits relative to the text. */
    coverPlacement?: CoverPlacement;
    /** Expanded from the preset. One line, or author and category stacked. */
    bylineFormat?: BylineFormat;
    /** From the picture's proportions, unless `Cover Fit` says otherwise. */
    coverFit?: CoverFit;
    showPreviewSummary?: boolean;
    /**
     * Ordering within an issue; higher sorts earlier. Independent of the
     * layout preset -- a Brief can still run above a Feature.
     */
    layoutWeight?: number;
    options?: Array<string>;
    series_tag?: string;
    series_title?: string;
    prev?: string;
    next?: string;
    toc?: TOC.Heading[];
    tags?: Array<Tags.Tag | string>;
  };

  export enum CoverStyle {
    TOP = 'TOP',
    RIGHT = 'RIGHT',
    BOT = 'BOT',
    LEFT = 'LEFT',
    /** Retired: the rendering branch was removed, and the converter no longer
        accepts this value. Kept so old stored metadata still types. */
    IN = 'IN',
    NONE = 'NONE',
  }
}

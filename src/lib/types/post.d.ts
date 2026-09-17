import type { TOC } from '$lib/types/toc';
import type { Tags } from '$lib/types/tags';
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
    /** Space allocation on the front page. Drives grid spans. */
    layoutSize?: LayoutSize;
    showPreviewSummary?: boolean;
    /** Ordering within an issue; higher sorts earlier. Independent of size. */
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
    IN = 'IN',
    NONE = 'NONE',
  }

  /**
   * How much page space a story gets. Purely spatial: it says nothing about
   * whether there is a cover image or a summary, which are their own
   * properties. `brief` was called `compact` when it also implied "no cover".
   */
  export type LayoutSize = 'brief' | 'standard' | 'feature';

}

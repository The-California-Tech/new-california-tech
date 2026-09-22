<!-- packages/california-tech/src/lib/components/index_post.svelte -->
<script lang="ts">
  import type { Post } from '$lib/types/post';
  import { UserConfig } from '$config/QWER.config';
  import ImgBanner from '$lib/components/image_banner.svelte';

  const { data, index, showDate = false }: { data: Post.Post; index: number; showDate?: boolean } = $props();

  const numberPostsEager = 3;
  const showPreviewSummary = $derived(data.showPreviewSummary ?? true);
  const previewCover = $derived(data.thumbnail ?? data.cover);
  // Only meaningful when there is a cover to put beside the text. 'Behind'
  // (coverStyle IN) is its own arrangement and outranks placement.
  const useSidebar = $derived(data.coverPlacement === 'sidebar');
  const bylineFormat = $derived(data.bylineFormat ?? 'stacked');
  const category = $derived(data.tags?.[0]);
  const coverFit = $derived(data.coverFit ?? 'fill');
  const hasSummary = $derived(showPreviewSummary && Boolean(data.summary_html || data.summary));

  // Reserve space for the cover image before it loads to prevent CLS.
  // Falls back to undefined (no forced ratio) if dimensions weren't backfilled.
  const coverAspectRatio = $derived.by(() => {
    const { coverWidth, coverHeight } = data;
    if (!coverWidth || !coverHeight) return undefined;
    return `${coverWidth} / ${coverHeight}`;
  });

  const formattedDate = $derived.by(() => {
    const publishDate = new Date(data.published);
    if (Number.isNaN(publishDate.getTime())) {
      return '';
    }

    return publishDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'America/Los_Angeles',
    });
  });
</script>

<!--
  The card's text is ONE multi-column flow: headline, byline and summary all
  live in the same container, and each element's arrangement is the single
  question of whether it spans the columns or sits inside one. That replaced
  three separate zones (a headline block, a centred byline band, and a
  separately-measured summary), each of which had to be kept in sync by hand.

  The cover is deliberately NOT in this flow. A spanning image mid-flow is the
  case where multicol fragmentation gets least predictable across engines, and
  the cover already has its own sizing rules worth keeping.
-->
<!--
  `src` is a parameter rather than read from the closure: previewCover is
  `string | undefined`, and although this snippet only renders inside
  `{#if previewCover}`, Svelte's narrowing does not cross the snippet boundary.
  Passing it from inside the guard carries the narrowed type in.
-->
{#snippet coverImage(src: string)}
  <!--
    w-full only when filling. With `contain` the image is narrower than the
    frame, and a full-width anchor around it defeats the frame's
    justify-content: center -- which is why letterboxed covers were pinned to
    the left edge instead of sitting in the middle.
  -->
  <a href={data.slug} class="cursor-pointer block h-full {coverFit === 'fill' ? 'w-full' : ''}" itemprop="url">
    <ImgBanner
      {src}
      loading={index < numberPostsEager ? 'eager' : 'lazy'}
      decoding={index < numberPostsEager ? 'auto' : 'async'}
      width={data.coverWidth}
      height={data.coverHeight}
      imgClass="op-90 group-hover:scale-105 transition transform duration-300 ease-in-out {coverFit === 'fill'
        ? 'h-full w-full object-cover'
        : 'h-full w-auto max-w-full object-contain'}" />
  </a>
{/snippet}

{#snippet textFlow()}
  <div class="card-text">
    <h2 class="headline" itemprop="name headline">
      <a href={data.slug} class="u-url title-link" itemprop="url">
        {data.title || 'No Title'}
      </a>
    </h2>

    <div class="metadata" data-format={bylineFormat}>
      {#if bylineFormat === 'inline'}
        <p class="byline-line">
          {#if data.authors && data.authors.length > 0}
            <span class="author" itemprop="author">{data.authors.join(', ')}</span>
          {/if}
          {#if category}
            <span class="sep" aria-hidden="true">·</span>
            <span class="category">{category}</span>
          {/if}
          {#if showDate && formattedDate}
            <span class="sep" aria-hidden="true">·</span>
            <span class="published-date">{formattedDate}</span>
          {/if}
        </p>
      {:else}
        {#if data.authors && data.authors.length > 0}
          <p class="author" itemprop="author">{data.authors.join(', ')}</p>
        {/if}
        {#if category}
          <p class="category">{category}</p>
        {/if}
        {#if showDate && formattedDate}
          <p class="published-date">{formattedDate}</p>
        {/if}
      {/if}
    </div>

    <!--
      The summary is the ONLY thing inside the clipped flow.

      That is the whole point of this structure. The clip is quantised with
      round(down, 100%, one-summary-line), which lands on a line boundary only
      if the summary starts at the top of the box being rounded. When the
      headline and byline lived in here too, the summary began at an offset that
      was not a multiple of its own line height -- so the clip, and the ellipsis
      pinned to it, landed mid-line by an amount that varied with how many lines
      the headline happened to wrap to.

      Keeping them out also means neither can ever be clipped, which is what was
      eating bylines off the short cards.
    -->
    {#if hasSummary}
      <div class="summary-block">
        <div class="summary-flow">
          {#if data.summary_html}
            <p class="summary" itemprop="description">{@html data.summary_html}</p>
          {:else}
            <p class="summary" itemprop="description">{data.summary}</p>
          {/if}
        </div>
        <a href={data.slug} class="continued">(continued)</a>
      </div>
    {/if}
  </div>
{/snippet}

{#if data}
  <article
    itemscope
    itemtype="https://schema.org/BlogPosting"
    itemprop="blogPost"
    class="index-post flex flex-col relative w-full overflow-hidden group">
    {#if data.series_tag && data.series_title}
      <div class="series flex items-stretch gap-0 z-10">
        <a
          href="/?tag={data.series_tag}"
          class="series-tag py-2 cursor-pointer"
          aria-label="Filter by series tag: {data.series_tag}">
          <div class="pl-4 pr-3 text-sm font-bold"># {data.series_tag} {UserConfig.SeriesTagName}</div>
        </a>
        <div class="series-title flex-1 py-2">
          <div
            class="px-3 text-sm font-semibold tracking-wide align-middle whitespace-normal line-clamp-1 text-ellipsis">
            {data.series_title}
          </div>
        </div>
      </div>
    {/if}

    {#if previewCover && data.coverStyle !== 'NONE'}
      {#if useSidebar}
        <div class="post-body sidebar-row">
          {@render textFlow()}
          <div class="cover-frame cover-frame-aside" data-fit={coverFit} style:--cover-ar={coverAspectRatio}>
            {@render coverImage(previewCover)}
          </div>
        </div>
      {:else}
        <div class="post-body">
          <div class="cover-frame" data-fit={coverFit} style:--cover-ar={coverAspectRatio}>
            {@render coverImage(previewCover)}
          </div>
          <div class="index-post-panel px-1 pt-4 pb-1 flex flex-col flex-1">
            {@render textFlow()}
          </div>
        </div>
      {/if}
    {:else}
      <div class="index-post-panel index-post-panel-bare flex flex-col flex-1 px-1 pt-1 pb-1">
        {@render textFlow()}
      </div>
    {/if}
  </article>
{/if}

<style lang="scss">
  .index-post {
    /* Shared by the byline and the summary so their lines sit on one rhythm. */
    --card-leading: 1.4;

    /*
     * The summary's line height, stated rather than inferred.
     *
     * The clip and the corner link both quantise against this. They used to use
     * `1lh`, which resolves against whatever font the *container* happens to
     * have -- and now that the headline lives in the same flow, that container
     * is no longer guaranteed to match the prose. Naming the unit means the
     * rounding is against the summary's lines specifically, which is what the
     * bottom edge should land on, whatever else is in the flow above it.
     */
    --summary-size: 1rem;
    --summary-line: calc(var(--summary-size) * var(--card-leading));

    display: flex;
    flex-direction: column;
    /*
     * The grid cell owns the height now -- .post-wrapper spans a whole number
     * of fixed rows, sized by the story's Layout Size. This used to be
     * `aspect-ratio: 1 / 2`, which made the card 2x its own width and therefore
     * usually taller than the cell it sits in; the overflow was then clipped,
     * which is why cards with covers showed no text at all. Two things cannot
     * both decide the height.
     */
    height: 100%;
    min-height: 0;
    border: 0;
    box-shadow: none;
    color: var(--qwer-text-color);
    background-color: transparent;

    h2 a {
      color: var(--qwer-title-color);

      &:hover {
        color: var(--qwer-title-hover-color);
      }
    }
  }

  /*
   * The cover keeps its real proportions, and is capped vertically.
   *
   * aspect-ratio comes from the actual image (--cover-ar), so a wide photo is
   * short and a tall photo is tall -- no cropping, which is what object-fit:
   * cover was doing before and why everything looked uniform. max-height then
   * stops a portrait cover from eating the whole card; when it bites, the image
   * shrinks *horizontally* to keep its ratio and centres, leaving margins at
   * the sides rather than cutting the picture.
   *
   * Keeping aspect-ratio here also preserves the anti-CLS reservation: the
   * frame knows its height before the image arrives.
   */
  /*
   * Two shapes, chosen per photo.
   *
   * `contain` (the default here) takes the image's own aspect-ratio, so a tall
   * photo is tall and nothing is cropped; the cap stops it eating the card, and
   * when it bites the image narrows and centres, leaving side gutters.
   *
   * `fill` gives up the image's ratio and takes the card's budget as its
   * height, cropping instead. No gutters, which is what a landscape photo
   * wants -- containing one only ever buys empty space.
   *
   * Both reserve their height before the image loads, so neither shifts layout:
   * contain from aspect-ratio, fill from a percentage of a definite card.
   */
  .cover-frame[data-fit='fill'] {
    aspect-ratio: auto;
    flex: 0 0 auto;
    height: var(--cover-max, 46%);
  }

  .cover-frame {
    position: relative;
    width: 100%;
    flex: 0 1 auto;
    aspect-ratio: var(--cover-ar, 16 / 9);
    max-height: var(--cover-max, 46%);
    min-height: 0;
    overflow: hidden;
    display: flex;
    justify-content: center;

    /*
     * Transparent, not --qwer-bg-color. The page paints that colour AND an
     * overlay image on top of it (body::after), so a box filling with the bare
     * variable reads as a slightly darker panel against the page it is sitting
     * on. Letting the page show through is the only way to actually match it.
     */
    background-color: transparent;
  }

  /* A brief is short enough that a tall cover would crowd out the words. */
  :global([data-prominence='brief']) .cover-frame {
    --cover-max: 40%;
  }

  /* A feature has room to lead with the image. */
  :global([data-prominence='feature']) .cover-frame {
    --cover-max: 55%;
  }

  /* A stacked lead is a picture story; it can give the image half the box. */
  :global([data-prominence='lead']) .cover-frame {
    --cover-max: 50%;
  }

  /*
   * No summary means the card is a picture with a headline under it, so the
   * image takes the larger share of a box that is already short. Not more than
   * 62%: the remainder still has to hold a headline that may wrap to three
   * lines, plus the byline.
   *
   * This outranks the per-size rules above on specificity, which is intended --
   * a brief's 40% is for a brief that an editor gave a summary to.
   */
  :global(.post-wrapper:not([data-summary])) .cover-frame {
    --cover-max: 62%;
  }

  /*
   * A brief is the shortest card that still carries a photo, so 62% left too
   * little for a headline that wraps plus a byline -- the byline was the thing
   * being clipped. More specific than the rule above, so it wins.
   */
  :global(.post-wrapper[data-prominence='brief']:not([data-summary])) .cover-frame {
    --cover-max: 48%;
  }

  .post-body {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  /*
   * Prose and picture on the same column tracks.
   *
   * This is a grid, not a flex row, because the photo has to be a whole number
   * of text columns wide -- "two columns" is not something CSS multicol can
   * express (column-span takes all or nothing), so the card lays out the
   * columns itself and hands a slice to each. The photo gets --cover-cols
   * tracks, the prose gets --body-cols, and because both use the same gap, the
   * text columns line up with the grid the photo is measured against.
   *
   * The counts are declared per breakpoint on .post-wrapper; see index_posts.
   */
  .sidebar-row {
    display: grid;
    grid-template-columns: repeat(var(--text-cols, 3), minmax(0, 1fr));
    column-gap: var(--col-gap, 1.25rem);
    align-items: stretch;
    flex: 1 1 auto;
    height: 100%;
    min-height: 0;
    padding: 0 0.25rem;

    /* The prose gets fewer columns than the card has, so the flow must be told. */
    --flow-cols: var(--body-cols, 2);
  }

  .sidebar-row .card-text {
    grid-column: span var(--body-cols, 2);
    min-width: 0;
  }

  .cover-frame-aside {
    grid-column: span var(--cover-cols, 1);
    /* The row's height is definite, so this percentage resolves. */
    max-height: 100%;
    align-self: flex-start;
    width: 100%;
  }

  /*
   * One column wide: there is no "outer column" to put a picture in, so the
   * arrangement falls back to stacked. column-reverse keeps the image on top,
   * which is the stacked order, without reordering the markup.
   */
  @media (max-width: 511px) {
    .sidebar-row {
      display: flex;
      flex-direction: column-reverse;
      gap: 0.5rem;
      --flow-cols: 1;
    }

    .cover-frame-aside {
      width: 100%;
      max-height: 45%;
    }
  }

  .metadata {
    --at-apply: 'flex flex-col items-center pb-0.5 mb-2 w-full';
    /*
     * A flex item defaults to `flex: 0 1 auto` -- shrinkable. Under pressure
     * the byline was being squeezed below its content height and clipped by the
     * card. It is one or two lines; it gets them.
     */
    flex: 0 0 auto;
    position: relative;
    font-size: 0.875rem;
    line-height: var(--card-leading);
    gap: 0;
    text-align: center;

    /* An author split from their category by a column break reads as two
       different people. */
    break-inside: avoid;
  }

  .byline-line {
    --at-apply: 'm-0';
    /* Wraps rather than overflowing when the names are long, but prefers one
       line -- which is the whole point of this format. */
    text-wrap: balance;
  }

  /*
   * One line, ranged left, no rule under it.
   *
   * The rule is there to close a stacked byline off from the story beneath it,
   * which a two- or three-line block needs. A single line does not: it already
   * reads as one unit, and a rule under it just adds a horizontal to a card
   * that has plenty.
   */
  .metadata[data-format='inline'] {
    --at-apply: 'items-start';
    text-align: left;
  }

  .metadata[data-format='inline']::after {
    content: none;
  }

  .sep {
    margin: 0 0.4em;
    opacity: 0.55;
  }

  /*
   * A pseudo-element rather than border-bottom, because the rule is narrower
   * than the block -- a border always spans the full edge. A fixed percentage
   * of the column, so it scales with the column rather than the card: at a
   * fixed length a double-width feature got a divider twice its neighbours'.
   */
  .metadata::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 60%;
    max-width: 10rem;
    height: 1px;
    background: var(--qwer-text-color);
  }

  .author {
    --at-apply: 'font-600 m-0';
  }

  .category {
    --at-apply: 'm-0 op-70';
  }

  .published-date {
    --at-apply: 'm-0 op-70';
  }

  /*
   * The text column of the card: headline, byline, then the summary.
   *
   * Only the summary is clipped, and only the summary is inside the flow that
   * gets quantised. See the comment in the markup for why that matters.
   */
  .card-text {
    display: flex;
    flex-direction: column;
    flex: 1 0 auto;
    min-height: 0;
    height: 100%;
  }

  /*
   * Bounded, so the card cannot be overflowed by a long title.
   *
   * This is what makes headline + byline + cover fit by construction rather
   * than by luck: the byline is one or two lines by definition, the cover
   * absorbs whatever is left, and this is the only genuinely variable part. A
   * clamp turns it into a known maximum -- with a real ellipsis at the cut,
   * because line-clamp knows where it cut. It can do that here precisely
   * because this element is not a multi-column container; that combination is
   * the one CSS does not offer.
   */
  .headline {
    --at-apply: 'text-xl font-bold';
    flex: 0 0 auto;
    margin: 0 0 0.35rem;
    line-height: 1.25;

    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: var(--headline-lines, 4);
    line-clamp: var(--headline-lines, 4);
    overflow: hidden;
  }

  /* A lead has the room; a short card does not. */
  :global([data-prominence='lead']) .headline {
    --headline-lines: 5;
  }

  /*
   * Takes whatever the headline and byline left.
   *
   * min-height: 0 matters -- without it a flex item refuses to shrink below
   * its content, and the summary would push the card open instead of clipping.
   */
  /*
   * flex-basis 0, not auto.
   *
   * With `auto` the basis is the summary's *full* content height -- hundreds of
   * pixels -- which propagates outward: it inflates .card-text's basis, which
   * inflates .index-post-panel's, so .post-body ends up dividing height between
   * a photo and a panel claiming far more than the card has. Whether the byline
   * survived then depended on how the shrink arithmetic happened to land.
   *
   * Basis 0 means this block asks for nothing and takes only leftovers, so the
   * panel's content height is exactly headline + byline. That is the number the
   * layout above needs in order to guarantee them.
   */
  .summary-block {
    position: relative;
    flex: 1 1 0%;
    min-height: 0;
    line-height: var(--card-leading);
  }

  /*
   * Absolutely positioned, which is what makes the height *definite* and
   * therefore makes the percentage resolve at all: a percentage against a
   * flex-sized auto height silently computes to zero.
   *
   * round(down, 100%, one line) trims to a whole number of lines. Because this
   * box contains nothing but the summary, its top IS the first line's top, so
   * the rounding is exact -- that is the property the previous structure lost.
   *
   * One line shorter still, so the (continued) link has a line of its own and
   * never sits on top of prose.
   */
  .summary-flow {
    position: absolute;
    inset: 0;
    overflow: hidden;
    /* Unrounded cap first: without round() this degrades to possibly clipping a
       partial line, rather than to no cap at all. Baseline since May 2024. */
    max-height: 100%;
    max-height: calc(round(down, 100%, var(--summary-line)) - var(--summary-line));

    column-count: var(--flow-cols, var(--text-cols, 1));
    column-gap: var(--col-gap, 1.25rem);
    column-fill: auto;
  }

  /*
   * font-size and line-height are set here rather than taken from `text-base`,
   * which also ships a line-height (1.5rem). The flow is quantised against
   * --summary-line, so if the paragraph's real line height differs, the
   * rounding counts a line that is not there.
   *
   * Hyphenation earns its keep once the columns get narrow: justified text in a
   * 9rem column without it opens rivers of whitespace.
   */
  .summary {
    --at-apply: 'm-0';
    font-size: var(--summary-size);
    line-height: inherit;
    text-align: justify;
    hyphens: auto;
    white-space: pre-line;
  }

  /*
   * There is no ellipsis marking the cut, and this is deliberate.
   *
   * To sit at the end of the cut text it has to be flush with the prose's right
   * edge -- but the summary is justified, so that line runs all the way to that
   * edge and the marker lands on top of its last glyph. Insetting the marker
   * instead puts it outside the column it belongs to, which reads as a
   * misalignment. Both were tried. There is no third position, because CSS
   * cannot shorten the one line that needs shortening: the clip point is not
   * something the engine will tell you about.
   *
   * (continued) on its own line carries the same meaning without needing to
   * know where the text stopped.
   */

  /*
   * Pinned to the corner rather than floated into the last line.
   *
   * The float-and-spacer version put the link at the end of the final line of
   * prose, which was better typography -- but it depends on there being one
   * flow to be at the end of. With columns there are several, and a float goes
   * to the top of whichever column it starts in.
   *
   * `bottom` is the leftover that round() trimmed off, so the link's bottom
   * edge meets the flow's bottom edge exactly rather than the block's -- those
   * differ by up to one line.
   *
   * The background is a mask: the last column's final line runs underneath.
   */
  .continued {
    --at-apply: 'font-600';
    position: absolute;
    right: 0;
    bottom: 0;
    /*
     * The remainder round() trimmed off, so the link's bottom edge sits where
     * the un-shortened flow would have ended -- which puts the link exactly on
     * the line the flow above it gave up.
     */
    bottom: calc(100% - round(down, 100%, var(--summary-line)));
    z-index: 1;
    font-size: 1rem;
    line-height: inherit;
    color: var(--qwer-text-color);
    text-decoration: underline;

    /*
     * Not --qwer-title-hover-color: that resolves to plain `white` in dark mode
     * and `black` in light, so the link vanished into the card on hover.
     */
    &:hover {
      color: var(--qwer-link-hover-color);
    }
  }

  /*
   * grow 1, shrink 0. Its basis is now headline + byline (see .summary-block),
   * so refusing to shrink is a guarantee that those always fit -- the cover is
   * the only thing left that can give, which is the right priority. Words
   * before pictures.
   */
  .index-post-panel {
    background-color: transparent;
    flex: 1 0 auto;
    min-height: 0;
  }

  .series {
    border-bottom: 3px solid var(--qwer-series-border-color);
    box-shadow: 0 0 3px var(--qwer-series-border-color);
  }

  .series-tag {
    background-color: var(--qwer-series-bg-color);
    color: var(--qwer-series-tag-text-color);
    &:hover {
      background-color: var(--qwer-series-bg-hover-color);
    }
  }

  .series-title {
    background-color: var(--qwer-bg-color);
    color: var(--qwer-series-title-text-color);
  }
</style>

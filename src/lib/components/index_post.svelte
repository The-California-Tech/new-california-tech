<!-- packages/california-tech/src/lib/components/index_post.svelte -->
<script lang="ts">
  import type { Post } from '$lib/types/post';
  import { UserConfig } from '$config/QWER.config';
  import ImgBanner from '$lib/components/image_banner.svelte';

  const { data, index, showDate = false }: { data: Post.Post; index: number; showDate?: boolean } = $props();

  const numberPostsEager = 3;
  const showPreviewSummary = $derived(data.showPreviewSummary ?? true);
  const previewCover = $derived(data.thumbnail ?? data.cover);

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
  The byline/summary blocks were identical in all three cover branches (Behind,
  Top, None), so any change to them had to be made three times and stay in
  sync. Snippets collapse that to one definition.
-->
{#snippet metaBlock()}
  <div class="metadata">
    {#if data.authors && data.authors.length > 0}
      <p class="author" itemprop="author">{data.authors.join(', ')}</p>
    {/if}
    {#if data.tags && data.tags.length > 0}
      <p class="category">{data.tags[0]}</p>
    {/if}
    {#if showDate && formattedDate}
      <p class="published-date">{formattedDate}</p>
    {/if}
  </div>
{/snippet}

{#snippet summaryBlock()}
  {#if showPreviewSummary && (data.summary_html || data.summary)}
    <!--
      The link comes *before* the text on purpose. It is floated, so the prose
      wraps around it and it lands at the end of the last visible line instead
      of consuming a line of its own. Source order is what makes that work.
    -->
    <div class="summary-block">
      <div class="summary-clip">
        <a href={data.slug} class="continued">(continued)</a>
        <span class="continued-ellipsis" aria-hidden="true">…</span>
        {#if data.summary_html}
          <p class="summary" itemprop="description">{@html data.summary_html}</p>
        {:else}
          <p class="summary" itemprop="description">{data.summary}</p>
        {/if}
      </div>
    </div>
  {/if}
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
      {#if data.coverStyle === 'IN'}
        <div class="cover-frame cover-frame-fill" style:--cover-ar={coverAspectRatio}>
          <ImgBanner
            loading={index < numberPostsEager ? 'eager' : 'lazy'}
            decoding={index < numberPostsEager ? 'auto' : 'async'}
            src={previewCover}
            width={data.coverWidth}
            height={data.coverHeight}
            imgClass="z-1 blur-sm op-80 absolute object-cover w-full h-full transition transform duration-300 ease-in-out group-hover:(scale-110 blur-none)" />
        </div>
        <div class="coverStyle-IN z-2 px-6 pt-4 pb-1 flex flex-col gap-2 bg-white/[0.25] dark:bg-black/[0.25]">
          <h2 class="text-xl font-bold" itemprop="name headline">
            <a href={data.slug} class="u-url title-link" itemprop="url">
              {data.title || 'No Title'}
            </a>
          </h2>
          {@render metaBlock()}
          {@render summaryBlock()}
        </div>
      {:else}
        <div class="post-body">
          <div class="cover-frame" style:--cover-ar={coverAspectRatio}>
            <a href={data.slug} class="cursor-pointer block h-full" itemprop="url">
              <ImgBanner
                src={previewCover}
                loading={index < numberPostsEager ? 'eager' : 'lazy'}
                decoding={index < numberPostsEager ? 'auto' : 'async'}
                width={data.coverWidth}
                height={data.coverHeight}
                imgClass="op-90 group-hover:scale-105 transition transform duration-300 ease-in-out h-full w-auto max-w-full object-contain" />
            </a>
          </div>
          <div class="index-post-panel px-1 pt-4 pb-1 flex flex-col gap-2 flex-1">
            <h2 class="text-xl font-bold" itemprop="name headline">
              <a href={data.slug} class="u-url title-link" itemprop="url">
                {data.title || 'No Title'}
              </a>
            </h2>
            {@render metaBlock()}
            {@render summaryBlock()}
          </div>
        </div>
      {/if}
    {:else}
      <div class="index-post-panel index-post-panel-bare flex flex-col flex-1 gap-2 px-1 pt-1 pb-1">
        <h2 class="text-xl font-bold" itemprop="name headline">
          <a href={data.slug} class="u-url title-link" itemprop="url">
            {data.title || 'No Title'}
          </a>
        </h2>
        {@render metaBlock()}
        {@render summaryBlock()}
      </div>
    {/if}
  </article>
{/if}

<style lang="scss">
  .index-post {
    /* Shared by the byline and the summary so their lines sit on one rhythm. */
    --card-leading: 1.4;

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
    background-color: var(--qwer-bg-color);
  }

  /* A brief is short enough that a tall cover would crowd out the words. */
  :global([data-size='brief']) .cover-frame {
    --cover-max: 40%;
  }

  /* A feature has room to lead with the image. */
  :global([data-size='feature']) .cover-frame {
    --cover-max: 55%;
  }

  .post-body {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  /*
   * The "Behind" treatment: the image is a backdrop for the whole card, with
   * the text layered over it. It has to leave the flex flow to do that --
   * as an ordinary flex sibling it would take a share of the height and the
   * text would sit underneath, which is not what blur + a translucent panel
   * are for. This branch was unreachable until covers stopped being derived
   * from layout size, so it had never actually been laid out.
   */
  .cover-frame-fill {
    position: absolute;
    inset: 0;
    flex: none;
    z-index: 0;
  }

  .coverStyle-IN {
    position: relative;
  }

  /* Byline stacked and centred, with a rule closing it off from the story. */
  /*
   * font-size is set here rather than via `text-sm`, which also ships its own
   * line-height (1.25rem) and would fight --card-leading. `gap` is zero for the
   * same reason: spacing between the author and category lines should come from
   * the line height alone, or it will not match the summary below.
   */
  .metadata {
    --at-apply: 'flex flex-col items-center pb-0.5 mb-2 w-full';
    position: relative;
    font-size: 0.875rem;
    line-height: var(--card-leading);
    gap: 0;
    text-align: center;
  }

  /*
   * A pseudo-element rather than border-bottom, because the rule is narrower
   * than the block -- a border always spans the full edge. Centred under the
   * byline, in the text colour rather than the lighter metadata border colour.
   */
  .metadata::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    /*
     * A fixed length, not a percentage: at 40% the rule grew with the card, so
     * a double-width feature got a divider twice the width of its neighbours.
     * max-width keeps it inside the narrowest cards.
     */
    width: 10rem;
    max-width: 70%;
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
   * As many lines as actually fit, cut on a line boundary, link in the corner.
   *
   * A counted line total cannot work here, and the screenshots showed both
   * failure directions at once: the space left for the summary is the card
   * height, minus the byline, minus however many lines the headline wrapped to,
   * minus however tall this particular cover turned out. One number is wrong
   * both ways -- too small and a coverless card leaves dead space under the
   * link, too large and a card with a tall cover and a three-line headline gets
   * sliced through the middle of a line.
   *
   * So measure instead of guess.
   *
   *  - .summary-block flexes to whatever space is left.
   *  - .summary-clip is absolutely positioned inside it. That is what makes the
   *    height *definite*, and therefore makes percentages resolve at all: a
   *    percentage against a flex-sized auto height silently computes to zero,
   *    which is what collapsed the spacer and threw the link to the top corner.
   *  - round(down, 100%, --line) trims the visible area to a whole number of
   *    lines, so the bottom edge always lands on a line boundary.
   *  - The spacer is that height minus one line, so the floated link sits on
   *    the final line with the prose wrapping around it.
   *
   * No per-size tuning, because nothing is being guessed.
   */
  .summary-block {
    position: relative;
    flex: 1 1 auto;
    min-height: 0;
    line-height: var(--card-leading);
  }

  .summary-clip {
    position: absolute;
    inset: 0;
    overflow: hidden;
    /* Unrounded cap first: without round() this degrades to possibly clipping a
       partial line, rather than to no cap at all. Baseline since May 2024. */
    max-height: 100%;
    max-height: round(down, 100%, 1lh);
  }

  .summary-clip::before {
    content: '';
    float: left;
    width: 0;
    height: calc(100% - 1lh);
    height: calc(round(down, 100%, 1lh) - 1lh);
  }

  /*
   * font-size and line-height are set here rather than taken from `text-base`,
   * which also ships a line-height (1.5rem). If the paragraph's real line
   * height differs from the one the spacer is quantised against, the rounding
   * counts a line that is not there and the link lands a line early.
   */
  .summary {
    --at-apply: 'm-0';
    font-size: 1rem;
    line-height: inherit;
    text-align: justify;
    white-space: pre-line;
  }

  .continued {
    --at-apply: 'font-600';
    float: right;
    clear: both;
    margin-left: 0.2em;
    /*
     * Matches the prose. A float aligns by box edge, not baseline, so a smaller
     * font here made the link's line box shorter than the text's and it sat
     * slightly high against the last line.
     */
    font-size: 1em;
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
   * The ellipsis is a sibling of the link, not its ::before.
   *
   * Inside the link it inherited the underline (text-decoration propagates to
   * in-flow descendants and cannot be cancelled), so it needed display:
   * inline-block to escape -- and a baseline-aligned inline-block can make the
   * link's line box taller than one line, which turns the float into a
   * two-line obstacle and drops the link a line early. As its own floated
   * element it has neither problem.
   *
   * Source order matters: the link comes first, so it takes the rightmost
   * position; this floats in beside it without clearing.
   */
  .continued-ellipsis {
    float: right;
    margin-left: 0.6em;
    font-weight: 400;
    text-decoration: none;
    color: var(--qwer-text-color);
  }

  .coverStyle-IN {
    flex: 1;
    min-height: 0;
  }

  .index-post-panel {
    background-color: transparent;
    flex: 1;
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

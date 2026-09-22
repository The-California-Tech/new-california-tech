<!-- packages/california-tech/src/lib/components/index_posts.svelte -->
<script lang="ts">
  import { strings } from '$lib/strings';
  import { fade } from 'svelte/transition';
  import IndexPost from '$lib/components/index_post.svelte';
  import type { Post } from '$lib/types/post';

  let {
    posts = [],
    class: className,
    separateByIssueDate = true,
    showDateInCard = false,
  }: {
    posts?: Post.Post[];
    class?: string;
    separateByIssueDate?: boolean;
    showDateInCard?: boolean;
  } = $props();

  /**
   * What the card will actually put on the page.
   *
   * The wrapper is the element that carries the row span, so it has to know
   * whether there will be a cover and a summary -- those are what the height
   * budget is for. This mirrors the branch conditions in index_post.svelte; if
   * those change, change these.
   *
   * The preset has already been expanded by the converter, so what arrives here
   * is the resolved answer including any Cover Photo Style / Hide Summary
   * override. The wrapper never re-reads the preset for this.
   */
  function cardShape(p: Post.Post) {
    return {
      cover: Boolean((p.thumbnail ?? p.cover) && p.coverStyle !== 'NONE'),
      summary: Boolean((p.showPreviewSummary ?? true) && (p.summary_html || p.summary)),
    };
  }

  const groupedByIssueDate = $derived.by(() => {
    const groups: Array<{ issueDate: string; dateLabel: string; posts: Post.Post[] }> = [];
    // A local accumulator inside $derived.by, discarded when the derivation
    // returns. It is never read reactively, so SvelteMap would add tracking
    // overhead for nothing.
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const map = new Map<string, { issueDate: string; dateLabel: string; posts: Post.Post[] }>();

    for (const post of posts) {
      const publishDate = new Date(post.published);
      const issueDate = !Number.isNaN(publishDate.getTime())
        ? publishDate.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
        : '';
      const dateLabel = !Number.isNaN(publishDate.getTime())
        ? publishDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'America/Los_Angeles',
          })
        : 'Undated';
      const groupKey = issueDate || dateLabel;

      if (!map.has(groupKey)) {
        const group = { issueDate, dateLabel, posts: [] as Post.Post[] };
        map.set(groupKey, group);
        groups.push(group);
      }

      map.get(groupKey)!.posts.push(post);
    }

    return groups;
  });
</script>

<main
  id="index-posts"
  class="flex flex-col items-center py-4 gap-6 {className ?? ''}"
  itemscope
  itemprop="mainEntityOfPage"
  itemtype="https://schema.org/Blog">
  {#if posts.length === 0}
    <div
      class="h-[20rem] flex items-center justify-center"
      in:fade={{ duration: 300, delay: 300 }}
      out:fade={{ duration: 300 }}>
      <h2 class="text-3xl">{strings.NoPostFound()}</h2>
    </div>
  {:else}
    {#if separateByIssueDate}
      {#each groupedByIssueDate as issue (issue.issueDate)}
        <section class="issue-section" data-issue-date={issue.issueDate}>
          <div class="issue-divider">{issue.dateLabel}</div>
          <div class="issue-grid-clip">
            <div class="issue-grid">
              {#each issue.posts as p, index (p.slug)}
                {@const shape = cardShape(p)}
                <div
                  class="post-wrapper"
                  data-prominence={p.prominence ?? 'standard'}
                  data-placement={p.coverPlacement ?? 'stacked'}
                  data-cover={shape.cover ? '' : undefined}
                  data-summary={shape.summary ? '' : undefined}>
                  <IndexPost data={p} {index} showDate={showDateInCard} />
                </div>
              {/each}
            </div>
          </div>
        </section>
      {/each}
    {:else}
      <section class="issue-section">
        <div class="issue-grid-clip">
          <div class="issue-grid">
            {#each posts as p, index (p.slug)}
              {@const shape = cardShape(p)}
              <div
                class="post-wrapper"
                data-prominence={p.prominence ?? 'standard'}
                data-placement={p.coverPlacement ?? 'stacked'}
                data-cover={shape.cover ? '' : undefined}
                data-summary={shape.summary ? '' : undefined}>
                <IndexPost data={p} {index} showDate={showDateInCard} />
              </div>
            {/each}
          </div>
        </div>
      </section>
    {/if}
  {/if}
</main>

<style lang="scss">
  /*
   * Sticks to the top of the viewport for as long as its own issue is on
   * screen, then the next issue's banner pushes it off -- so the date of
   * whatever you are reading is always visible while scrolling back through
   * the archive.
   *
   * The spacing is padding rather than margin on purpose: a margin is outside
   * the background box, so once stuck, cards would scroll through the gap
   * above the rules. It also needs an opaque background for the same reason.
   *
   * Sticky works here because nothing in its ancestor chain clips overflow --
   * .issue-grid-clip is a sibling subtree, not a parent.
   */
  .issue-divider {
    --at-apply: 'py-4 whitespace-nowrap flex flex-col items-center self-stretch';
    position: sticky;
    top: 0;
    /* Above the cards, below the site header (z-40). */
    z-index: 20;
    background: var(--qwer-bg-color);
    width: 100%;
    box-sizing: border-box;
    gap: 0.5rem;
    line-height: 1;
    &:before {
      content: '';
      width: 100%;
      height: 0;
      border-top: 3px double var(--qwer-text-color);
    }
    &:after {
      content: '';
      width: 100%;
      height: 0;
      border-top: 3px double var(--qwer-text-color);
    }
  }

  .issue-section {
    --at-apply: 'w-full';
  }

  /*
   * Clips the outer rules, and has to wrap the grid *directly*.
   *
   * Putting overflow:hidden on .issue-section did not work: the date divider
   * sits inside the section above the grid, so shifting the grid up by a pixel
   * only slid it under the divider -- still inside the section, still painted.
   * The clip has to be the grid's own parent for the offset to push anything
   * out of it.
   */
  .issue-grid-clip {
    width: 100%;
    overflow: hidden;
  }

  /*
   * A page dummy, not a card grid.
   *
   * Rows are a fixed unit and every story spans an integer number of them, so
   * the grid tiles exactly. That is what removes the ragged whitespace without
   * needing masonry: heights are *declared* rather than measured, which also
   * means no JS and no layout shift. Native grid masonry would be the other way
   * to get packing, but in 2026 it is still behind flags in Chrome and Firefox
   * with two competing syntaxes unsettled -- and it would not buy us anything
   * here, because designed boxes already tile.
   *
   * --card-unit is the height the three sizes were tuned against. --row-unit,
   * the actual grid quantum, is a quarter of it, so a card carrying less than
   * the full complement can stop short without disturbing the ones that were
   * already right. Tune --card-unit and every size scales together.
   *
   * Everything here is in rem, and the breakpoints below are scaled to match,
   * so the whole page density follows the root font-size in global.scss.
   */
  .issue-grid {
    --card-unit: 5.5rem;
    --row-unit: calc(var(--card-unit) / 4);

    display: grid;
    grid-template-columns: repeat(1, minmax(0, 1fr));
    grid-auto-rows: var(--row-unit);
    gap: 0;
  }

  /*
   * Each cell draws its own left and top rule; the grid offset plus the clip
   * above removes the ones on the outer edge. Nothing counts cells, so a
   * feature spanning two columns cannot break it the way the old
   * nth-child(3n+1) arithmetic did.
   *
   * These are pseudo-elements rather than borders because the horizontal rule
   * is inset at both ends -- a border always spans the full edge, so the inset
   * is not expressible as one.
   */
  .post-wrapper {
    --at-apply: 'w-full';
    /*
     * Headline and byline, nothing else. Everything below adds to this.
     *
     * 7 rather than 6 because a headline wrapping to three lines plus a byline
     * does not fit in six -- and a card with nothing but a headline has no
     * business clipping it.
     */
    --span: 7;

    /*
     * How many text columns this card's prose runs in, and how many of them a
     * sidebar photo occupies.
     *
     * A card's text columns equal the number of *grid* columns it spans, so
     * every column of type on the front page sits on one rhythm -- a standard
     * story's single column is the same width as one column of a lead's four.
     * That is what a newspaper page actually is, and it is the only way to make
     * a photo "two columns wide" mean something: column-span in CSS multicol
     * accepts all or nothing, so an exact column count has to come from the
     * grid instead.
     *
     * Declared per breakpoint below rather than computed. calc() inside a
     * `span` needs an integer and browsers are inconsistent about resolving one
     * there, so these are spelled out.
     */
    --text-cols: 1;
    --cover-cols: 1;
    --body-cols: 1;
    --col-gap: 1.25rem;

    grid-row: span var(--span);
    position: relative;
    padding: 0.625rem;
    box-sizing: border-box;
    min-width: 0;
    overflow: hidden;
  }

  /* Vertical rule, full height of the cell. */
  .post-wrapper::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 1px;
    background: var(--qwer-text-color);
    pointer-events: none;
  }

  /*
   * Horizontal rule, spanning the full cell width.
   *
   * It used to stop short at both ends, which looked fine above a
   * double-width feature -- one cell, one unbroken rule -- but wrong below it,
   * where the two cells underneath each drew their own inset rule and left a
   * gap in the middle of what should read as a single line. A cell cannot tell
   * whether its neighbour is part of the same run, so the inset has to go.
   */
  .post-wrapper::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: var(--qwer-text-color);
    pointer-events: none;
  }

  /*
   * Interior rules only, at every breakpoint and regardless of spans.
   *
   * Shifting the whole grid up and left by the rule width puts the first
   * column's left rules and the first row's top rules outside .issue-grid-clip,
   * which clips them. Interior rules are untouched. Nothing here has to know
   * which cell begins a row, so a feature spanning two columns cannot break it
   * the way the old nth-child arithmetic did.
   */
  .issue-grid {
    margin: -1px 0 0 -1px;
  }

  /*
   * The height budget, in quarter-cards.
   *
   * The span is a function of the *prominence* and of what the card actually
   * renders, not of prominence alone. A story with no cover and no summary is a
   * headline and a byline whatever its Layout says, and giving it a standard's
   * height just left a hole under it. So: start from the tier, then subtract
   * the parts that are not there.
   *
   * With neither cover nor summary there is nothing tier-dependent left to
   * size, which is why the bare case is 6 everywhere and needs no per-tier rule.
   *
   * The unqualified rules below are `standard`; the others override. Specificity
   * does the work -- [data-cover][data-summary] outranks either alone, and a
   * rule naming data-prominence outranks one that does not.
   */
  .post-wrapper[data-cover] {
    --span: 12;
  }
  .post-wrapper[data-summary] {
    --span: 16;
  }
  .post-wrapper[data-cover][data-summary] {
    --span: 24;
  }

  /*
   * Was 8, which clipped the byline on most briefs: a photo, a headline that
   * wraps to two lines and a byline do not fit in 11rem. The one-line byline
   * format buys back a line; this buys back the rest.
   */
  .post-wrapper[data-prominence='brief'][data-cover] {
    --span: 11;
  }
  .post-wrapper[data-prominence='brief'][data-summary] {
    --span: 10;
  }
  .post-wrapper[data-prominence='brief'][data-cover][data-summary] {
    --span: 14;
  }

  .post-wrapper[data-prominence='feature'][data-cover] {
    --span: 16;
  }
  .post-wrapper[data-prominence='feature'][data-summary] {
    --span: 20;
  }
  .post-wrapper[data-prominence='feature'][data-cover][data-summary] {
    --span: 32;
  }

  .post-wrapper[data-prominence='lead'][data-cover] {
    --span: 20;
  }
  .post-wrapper[data-prominence='lead'][data-summary] {
    --span: 14;
  }
  .post-wrapper[data-prominence='lead'][data-cover][data-summary] {
    --span: 28;
  }

  /*
   * Beside the text rather than above it, so the picture's height is shared
   * with the prose instead of added to it. Only bites once there is more than
   * one column to put it in -- see the breakpoint block below, where the card
   * falls back to stacking.
   */
  .post-wrapper[data-prominence='lead'][data-placement='sidebar'][data-cover][data-summary] {
    --span: 22;
  }

  #index-posts {
    --at-apply: 'flex flex-col items-center w-full';
  }

  /*
   * Scaled down by a fifth from 640/900/1200/1600, to match the 80% root font
   * size -- the column count has to arrive at the same *apparent* width as
   * before, and smaller type means more columns fit. This is the part browser
   * zoom does for free that a root font-size does not: em in a media query is
   * relative to the browser's initial 16px, not to the value we set, so these
   * thresholds cannot track --card-unit automatically and have to be restated.
   */
  /*
   * A lead runs the full width of whatever the grid currently is -- `1 / -1`
   * needs no breakpoint, because on a phone "the full row" is one column and
   * the rule is simply a no-op. This is the whole argument for naming
   * prominence rather than widths: the instruction survives the translation.
   */
  .post-wrapper[data-prominence='lead'] {
    grid-column: 1 / -1;
  }

  /*
   * Below the first breakpoint the sidebar arrangement stacks (see the
   * media query in index_post.svelte), so its height budget goes back to
   * matching a stacked lead.
   */
  @media (max-width: 511px) {
    .post-wrapper[data-prominence='lead'][data-placement='sidebar'][data-cover][data-summary] {
      --span: 28;
    }
  }

  @media (min-width: 512px) {
    .issue-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    /* From here up, a feature earns width as well as height. */
    .post-wrapper[data-prominence='feature'] {
      grid-column: span 2;
    }

    .post-wrapper[data-prominence='feature'] {
      --text-cols: 2;
      --body-cols: 2;
    }
    .post-wrapper[data-prominence='lead'] {
      --text-cols: 2;
      --cover-cols: 1;
      --body-cols: 1;
    }
  }

  @media (min-width: 720px) {
    .issue-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .post-wrapper[data-prominence='lead'] {
      --text-cols: 3;
      --cover-cols: 1;
      --body-cols: 2;
    }
  }

  @media (min-width: 960px) {
    .issue-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .post-wrapper[data-prominence='lead'] {
      --text-cols: 4;
      --cover-cols: 2;
      --body-cols: 2;
    }
  }

  @media (min-width: 1280px) {
    .issue-grid {
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }

    .post-wrapper[data-prominence='lead'] {
      --text-cols: 5;
      --cover-cols: 2;
      --body-cols: 3;
    }
  }

  /*
   * DISABLED while the box/content fit is being sorted out. Where native
   * masonry exists it would pack the leftovers, but it also changes how row
   * spans behave, which makes it impossible to tell whether a layout problem is
   * ours or the browser's. Re-enable once the declared spans look right
   * unaided -- Safari 26 has this, Chrome and Firefox are behind flags.
   *
   * @supports (grid-template-rows: masonry) {
   *   .issue-grid {
   *     grid-template-rows: masonry;
   *   }
   * }
   */
</style>

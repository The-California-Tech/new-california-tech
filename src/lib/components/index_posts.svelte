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
                <div class="post-wrapper" data-size={p.layoutSize ?? 'standard'}>
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
              <div class="post-wrapper" data-size={p.layoutSize ?? 'standard'}>
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
   * --row-unit is the vertical quantum. Sizes are multiples of it:
   *   brief    1 col x 2 rows   a paragraph
   *   standard 1 col x 3 rows   headline, image, a few inches
   *   feature  2 col x 4 rows   the story you want read
   */
  .issue-grid {
    --row-unit: 4.5rem;

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
    position: relative;
    padding: 10px;
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
   * Shifting the whole grid up and left by the border width puts the first
   * column's left borders and the first row's top borders outside .issue-section,
   * which clips them. Interior borders are untouched. Nothing here has to know
   * which cell begins a row, so a feature spanning two columns cannot break it
   * the way the old nth-child arithmetic did.
   */
  .issue-grid {
    margin: -1px 0 0 -1px;
  }

  /* Sizes collapse to width 1 here; only the height budget carries hierarchy. */
  .post-wrapper[data-size='brief'] {
    grid-row: span 2;
  }
  .post-wrapper[data-size='standard'] {
    grid-row: span 6;
  }
  .post-wrapper[data-size='feature'] {
    grid-row: span 8;
  }

  #index-posts {
    --at-apply: 'flex flex-col items-center w-full';
  }

  @media (min-width: 640px) {
    .issue-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    /* From here up, a feature earns width as well as height. */
    .post-wrapper[data-size='feature'] {
      grid-column: span 2;
    }

  }

  @media (min-width: 900px) {
    .issue-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @media (min-width: 1200px) {
    .issue-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }

  @media (min-width: 1600px) {
    .issue-grid {
      grid-template-columns: repeat(5, minmax(0, 1fr));
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

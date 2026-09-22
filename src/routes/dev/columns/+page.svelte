<script lang="ts">
  /**
   * The span question, isolated — but rendered through the REAL card.
   *
   * The first version of this page had its own throwaway CSS, which meant the
   * byline it showed was not the byline the site actually renders. A probe that
   * disagrees with the thing it is probing is worse than no probe.
   *
   * The byline axis is format, not span: a byline never spans. A band across
   * four columns reads as a heading for all of them rather than as belonging to
   * the one story under it, so the only real question is how many lines it
   * takes.
   *
   * The photo is deliberately not a variable here. `column-span` accepts only
   * `all` or `none`, so an image in the flow is either the full card width or
   * exactly one column wide — there is no "two of four columns". Since a
   * one-column photo is never what we want, the cover stays outside the flow
   * where its width can be any fraction, and this page is purely about the
   * headline and byline.
   */
  import IndexPosts from '$lib/components/index_posts.svelte';
  import type { Post } from '$lib/types/post';
  import type { BylineFormat } from '$lib/utils/layout-preset';

  const SUMMARY = `On a Saturday afternoon this spring, part of Caltech's inaugural Integrated Core cohort found itself somewhere few first-year lab sections go: wandering the aisles of Home Depot, looking for tubing, buckets, connectors, and whatever else might help them build small-scale carbon capture systems from scratch.
One group was growing algae. Another was working with limestone. A third was still arguing about the pump, which had by then become a matter of some principle. The teaching assistants had been told not to intervene unless something was about to catch fire, which by mid-afternoon seemed rather less unlikely than it had at the start of the day.`;

  const COVER = (() => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
      <rect width="1600" height="900" fill="#b9c6d4"/>
      <text x="50%" y="50%" font-family="Georgia,serif" font-size="150" fill="#33414f"
            text-anchor="middle" dominant-baseline="middle">16:9</text>
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  })();

  const CASES: Array<{
    id: string;
    name: string;
    note: string;
    bylineFormat: BylineFormat;
  }> = [
    {
      id: 'a',
      name: 'Headline spans · byline stacked',
      note: 'Author and category on their own lines. Two lines of byline, which the taller cards can afford.',
      bylineFormat: 'stacked',
    },
    {
      id: 'b',
      name: 'Headline spans · byline on one line',
      note: 'Author · category. A line saved, which on the short cards is the line that was being clipped.',
      bylineFormat: 'inline',
    },
    {
      id: 'c',
      name: 'Headline in column · byline stacked',
      note: 'The headline starts column one rather than banding across the card. break-inside: avoid keeps it from fragmenting at the column break, which is what broke this before.',
      bylineFormat: 'stacked',
    },
    {
      id: 'd',
      name: 'Headline in column · byline on one line',
      note: 'The most compact arrangement, and what the short presets now use.',
      bylineFormat: 'inline',
    },
  ];

  function makePost(c: (typeof CASES)[number]): Post.Post {
    return {
      slug: `/dev/columns#${c.id}`,
      title: 'Integrated Core, One Year Later',
      description: '',
      authors: ['Damian R. Wilson'],
      tags: ['Feature'],
      summary: SUMMARY,
      summary_html: SUMMARY.split('\n')
        .map((p) => `<span>${p}</span>`)
        .join('\n'),
      published: '2026-06-02T12:00:00.000Z',
      updated: '2026-06-02T12:00:00.000Z',
      created: '2026-06-02T12:00:00.000Z',
      cover: COVER,
      coverWidth: 1600,
      coverHeight: 900,
      coverStyle: 'TOP' as Post.CoverStyle,
      showPreviewSummary: true,
      // `lead` so the card runs the full row and there is room for three or four
      // text columns — the span question is invisible at one column.
      prominence: 'lead',
      coverPlacement: 'sidebar',
      bylineFormat: c.bylineFormat,
      options: [],
    };
  }
</script>

<svelte:head><title>Column spanning — dev</title></svelte:head>

<main>
  <header>
    <h1>Headline spanning and byline format</h1>
    <p>
      Real cards, real CSS. The only differences are whether the headline carries <code>column-span: all</code>
      and whether the byline takes one line or two.
    </p>
    <p class="warn">
      Worth checking in Firefox and Safari as well as Chrome. <code>column-span</code>
      combined with a definite height and
      <code>column-fill: auto</code>
      is where engines have historically disagreed. What to look for: each column filled to the bottom in order, the headline
      never split across a column break, nothing colliding with the corner link.
    </p>
  </header>

  {#each CASES as c (c.id)}
    <section>
      <h2>{c.name}</h2>
      <p class="note">{c.note}</p>
      <IndexPosts posts={[makePost(c)]} separateByIssueDate={false} />
    </section>
  {/each}
</main>

<style>
  main {
    max-width: 80rem;
    margin: 0 auto;
    padding: 2rem 1rem 6rem;
  }

  h1 {
    font-size: 1.75rem;
    font-weight: 700;
  }

  h2 {
    font-size: 1.125rem;
    font-weight: 700;
    margin-bottom: 0.15rem;
  }

  .note,
  .warn {
    opacity: 0.75;
    font-size: 0.875rem;
  }

  .warn {
    border-left: 3px solid currentColor;
    padding-left: 0.75rem;
    margin-top: 1rem;
  }

  section {
    margin-top: 2.5rem;
  }

  code {
    font-family: ui-monospace, monospace;
    font-size: 0.9em;
  }
</style>

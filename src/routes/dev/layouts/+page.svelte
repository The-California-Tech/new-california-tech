<script lang="ts">
  import IndexPosts from '$lib/components/index_posts.svelte';
  import { autoCoverFit, LAYOUT_PRESETS, type LayoutPreset } from '$lib/utils/layout-preset';
  import type { Post } from '$lib/types/post';

  /**
   * Covers are inline SVG so this page works offline and, more importantly, so
   * the aspect ratios are chosen rather than whatever a placeholder service
   * happens to return. Ratio is what drives .cover-frame, so a landscape and a
   * portrait cover in the same preset are genuinely different cases.
   */
  function cover(w: number, h: number, label: string) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <rect width="${w}" height="${h}" fill="#b9c6d4"/>
      <rect x="1" y="1" width="${w - 2}" height="${h - 2}" fill="none" stroke="#41506099" stroke-width="2"/>
      <text x="50%" y="50%" font-family="Georgia,serif" font-size="${Math.round(Math.min(w, h) / 6)}"
            fill="#33414f" text-anchor="middle" dominant-baseline="middle">${label}</text>
    </svg>`;
    return { url: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`, w, h };
  }

  const LANDSCAPE = cover(1600, 900, '16:9');
  const SQUARISH = cover(1200, 1000, '6:5');
  const PORTRAIT = cover(900, 1300, '9:13');

  const SUMMARY = `Caltech's Integrated Core cohort spent Saturday afternoon somewhere few first-year lab sections go: wandering the aisles of Home Depot, looking for tubing, buckets, connectors, and whatever else might help them build small-scale carbon capture systems from scratch.
One group was growing algae. Another was working with limestone. A third was still arguing about the pump, which had by then become a matter of some principle. The teaching assistants had been told not to intervene unless something was about to catch fire.`;

  const TITLES: Record<LayoutPreset, string> = {
    lead: 'Integrated Core, One Year Later',
    'lead-photo-first': 'Spring Wildlife: Parenting Season on Campus',
    'lead-photo': 'Commencement, in Photographs',
    feature: 'CDS Responds to Reddit Post Alleging Issues at Browne',
    standard: "Opera's Rising Stars: The Pasadena Vocal Competition",
    'standard-text': 'The Work Continues: A Letter to the Community',
    brief: 'Caltech Y Volunteers Remove Ivy at the LA Arboretum',
    headline: 'End of Term: Wishing You a Great Summer from Housing & Dining',
  };

  const COVERS: Record<LayoutPreset, { url: string; w: number; h: number }> = {
    lead: LANDSCAPE,
    'lead-photo-first': LANDSCAPE,
    'lead-photo': SQUARISH,
    feature: LANDSCAPE,
    standard: PORTRAIT,
    'standard-text': LANDSCAPE,
    brief: SQUARISH,
    headline: LANDSCAPE,
  };

  function makePost(preset: LayoutPreset, index: number): Post.Post {
    const recipe = LAYOUT_PRESETS[preset];
    const art = COVERS[preset];
    const hasCover = recipe.cover;

    return {
      slug: `/dev/layouts#${preset}`,
      title: TITLES[preset],
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
      cover: hasCover ? art.url : undefined,
      coverWidth: hasCover ? art.w : undefined,
      coverHeight: hasCover ? art.h : undefined,
      coverStyle: (hasCover ? 'TOP' : 'NONE') as Post.CoverStyle,
      showPreviewSummary: recipe.summary,
      layoutPreset: preset,
      prominence: recipe.prominence,
      coverPlacement: recipe.coverPlacement,
      bylineFormat: recipe.bylineFormat,
      layoutWeight: -index,
      options: [],
    };
  }

  const PRESETS = Object.keys(LAYOUT_PRESETS) as LayoutPreset[];
  const everything = PRESETS.map(makePost);

  /** A filler run, so each preset can be seen sitting next to ordinary stories. */
  const filler = (n: number) =>
    Array.from({ length: n }, (_, i) => {
      const post = makePost('standard', 100 + i);
      return { ...post, slug: `/dev/filler-${i}`, title: `An Ordinary Standard Story (${i + 1})` };
    });
</script>

<svelte:head><title>Layout presets — dev</title></svelte:head>

<main class="dev-page">
  <header>
    <h1>Layout presets</h1>
    <p>
      Every preset, rendered through the real components and CSS. Resize the window to watch the column count change —
      the arrangements are supposed to survive it.
    </p>
  </header>

  <section>
    <h2>All eight together</h2>
    <p class="note">What a front page containing one of each would actually look like.</p>
    <IndexPosts posts={everything} separateByIssueDate={false} />
  </section>

  {#each PRESETS as preset (preset)}
    {@const recipe = LAYOUT_PRESETS[preset]}
    <section>
      <h2><code>{preset}</code></h2>
      <p class="note">
        prominence <strong>{recipe.prominence}</strong>
        · cover
        <strong>{recipe.coverPlacement}</strong>
        · byline
        <strong>{recipe.bylineFormat}</strong>
        · {recipe.cover ? 'photo' : 'no photo'} · {recipe.summary ? 'summary' : 'no summary'}
        {#if recipe.cover}
          · fit <strong>{autoCoverFit(COVERS[preset].w, COVERS[preset].h)}</strong>
          (auto)
        {/if}
      </p>
      <IndexPosts posts={[makePost(preset, 0), ...filler(5)]} separateByIssueDate={false} />
    </section>
  {/each}
</main>

<style>
  .dev-page {
    max-width: 90rem;
    margin: 0 auto;
    padding: 2rem 1rem 6rem;
  }

  header {
    margin-bottom: 3rem;
  }

  h1 {
    font-size: 2rem;
    font-weight: 700;
  }

  section {
    margin-bottom: 4rem;
  }

  h2 {
    font-size: 1.25rem;
    font-weight: 700;
    margin-bottom: 0.25rem;
  }

  .note {
    opacity: 0.7;
    font-size: 0.875rem;
    margin-bottom: 1rem;
  }

  code {
    font-family: ui-monospace, monospace;
  }
</style>

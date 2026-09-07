<!-- packages/california-tech/src/routes/+page.svelte -->
<script lang="ts">
  import { page } from '$app/state';
  import { browser } from '$app/environment';
  import { fly } from 'svelte/transition';
  import type { Post } from '$lib/types/post';
  import { mergeUniqueBy } from '$lib/utils/collections';
  import { buildCountLoadMoreHref, fetchPostPreviewPage, observeInfiniteScroll } from '$lib/utils/feed-client';

  import { siteConfig } from '$config/site';

  import IndexPosts from '$lib/components/index_posts.svelte';

  let { data } = $props();

  let posts = $state<Post.Post[]>([]);
  let hasMore = $state(false);
  /** Whole issues already rendered — the feed pages by issue, not by row. */
  let nextIssueOffset = $state<number>(0);
  let isLoadingMore = $state(false);
  let hasInitializedFromServer = $state(false);
  let sentinel = $state<HTMLDivElement | null>(null);

  const serverPosts = $derived(data.posts ?? []);
  const query = $derived(page.url.searchParams.get('q') || '');
  const activeTag = $derived(page.url.searchParams.get('tag') || '');
  const batchSize = $derived(data.batchSize ?? 30);
  const isFilterMode = $derived(Boolean(query || activeTag));
  const renderedPosts = $derived.by(() => (hasInitializedFromServer ? posts : serverPosts));

  // The no-JS fallback link is rendered during SSR, where $effect never runs --
  // so `hasMore` is still its initial `false` and buildCountLoadMoreHref would
  // return '', hiding the link entirely. Fall back to the server value until the
  // client has taken over.
  const effectiveHasMore = $derived(hasInitializedFromServer ? hasMore : Boolean(data.hasMore));

  const loadMoreHref = $derived.by(() => {
    return buildCountLoadMoreHref({
      basePath: '/',
      hasMore: effectiveHasMore,
      searchParams: page.url.searchParams,
      nextCountHint: data.nextCount,
      shownCount: data.shownCount,
      renderedCount: posts.length,
      batchSize,
    });
  });

  async function loadMorePosts() {
    if (!browser || isLoadingMore || !hasMore) return;

    isLoadingMore = true;
    try {
      const payload = await fetchPostPreviewPage(fetch, {
        issueOffset: nextIssueOffset,
        limit: batchSize,
        query,
        tag: activeTag,
      });
      posts = mergeUniqueBy(posts, payload.posts, (post) => post.slug);
      nextIssueOffset = payload.nextIssueOffset;
      hasMore = payload.hasMore;
    } catch (error) {
      console.error('Failed to load more posts:', error);
    } finally {
      isLoadingMore = false;
    }
  }

  $effect(() => {
    posts = serverPosts;
    hasMore = Boolean(data.hasMore);
    nextIssueOffset = data.issueCursor ?? 0;
    hasInitializedFromServer = true;
  });

  $effect(() => {
    if (!browser || !sentinel || !hasMore) return;
    return observeInfiniteScroll(sentinel, () => void loadMorePosts());
  });

  /**
   * REMOVED (Sep 2026): a scroll listener that rewrote the address bar to
   * /issues/<date> as each issue section passed the top of the viewport.
   *
   * It made the homepage URL a lie. You would land on `/`, scroll two issues
   * down, and be sitting at /issues/2026-08-28 without having navigated
   * anywhere -- so bookmarking, copying the URL, or refreshing all took you
   * somewhere you had not asked to go. It also meant `/` and every
   * /issues/<date> served overlapping content with no canonical signal.
   *
   * The feed still scrolls back through older issues; it just does not
   * renumber the URL while doing it. Deliberate navigation between issues is
   * what /issues and the prev/next links on /issues/<date> are for.
   */
</script>

<svelte:head>
  <!--
    The homepage feed overlaps the per-issue pages by design (it scrolls back
    through the same articles). A self-referential canonical keeps `/` as the
    indexed URL for the feed itself, while /issues/<date> canonicalises to
    itself for a specific issue. Note this is deliberately bare: `?count=`,
    `?q=` and `?tag=` variants all canonicalise to `/`, since they are views of
    the same feed rather than distinct pages.
  -->
  <link rel="canonical" href={`${siteConfig.url}/`} />
</svelte:head>

<div
  itemscope
  itemtype="https://schema.org/Blog"
  itemprop="blog"
  class="flex justify-center items-start max-w-[90rem] mx-auto px-4">
  <div
    in:fly|global={{ y: 100, duration: 300, delay: 300 }}
    out:fly|global={{ y: -100, duration: 300 }}
    class="h-feed min-h-[50vh] w-full">
    <IndexPosts posts={renderedPosts} separateByIssueDate={!isFilterMode} showDateInCard={isFilterMode} />

    {#if browser && hasMore}
      <div bind:this={sentinel} class="h-8 w-full" aria-hidden="true"></div>
    {/if}

    {#if browser && isLoadingMore}
      <div class="py-4 text-center text-sm op-70">Loading more posts...</div>
    {/if}

    {#if browser && hasMore && !isLoadingMore}
      <div class="py-6 flex justify-center">
        <button
          type="button"
          onclick={() => void loadMorePosts()}
          class="border px-4 py-2 rounded hover:op-80 transition">
          Load more
        </button>
      </div>
    {/if}

    {#if !browser && loadMoreHref}
      <div class="py-6 flex justify-center">
        <a href={loadMoreHref} class="border px-4 py-2 rounded hover:op-80 transition">Load more</a>
      </div>
    {/if}
  </div>
</div>

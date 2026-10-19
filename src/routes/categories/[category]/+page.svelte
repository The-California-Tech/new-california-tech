<script lang="ts">
  import { fade } from 'svelte/transition';
  import { siteConfig } from '#config/site.ts';
  import IndexPosts from '#lib/components/index_posts.svelte';
  import ListingPager from '#lib/components/listing_pager.svelte';

  let { data } = $props();

  const basePath = $derived(`/categories/${encodeURIComponent(data.category.slug)}`);

  const canonical = $derived(
    new URL(`${basePath}${data.pageNumber > 1 ? `?page=${data.pageNumber}` : ''}`, siteConfig.url).href,
  );
</script>

<svelte:head>
  <title>{data.category.name} | The California Tech</title>
  <meta name="description" content="{data.category.name} from The California Tech." />
  <link rel="canonical" href={canonical} />
</svelte:head>

<!--
  Shown like search results -- the homepage's cards, undivided, each with its
  date -- in the homepage's container, so the cards are the same size as
  there. Not article_list.svelte: that list has no bylines, which suits an
  author page and nothing else.
-->
<div class="w-full px-8 py-8" in:fade={{ duration: 300, delay: 300 }} out:fade={{ duration: 300 }}>
  <header class="max-w-7xl mx-auto pb-4 border-b-2 border-black dark:border-white">
    <p class="text-sm uppercase tracking-wide opacity-70 mb-1"><a class="link" href="/categories">Categories</a></p>
    <h1 class="text-4xl font-bold mb-2">{data.category.name}</h1>
    <p class="text-lg opacity-80">
      {data.total}
      {data.total === 1 ? 'article' : 'articles'}
    </p>
  </header>

  <div class="max-w-7xl mx-auto">
    <IndexPosts posts={data.posts} separateByIssueDate={false} showDateInCard />
    <ListingPager pageNumber={data.pageNumber} totalPages={data.totalPages} {basePath} />
  </div>
</div>

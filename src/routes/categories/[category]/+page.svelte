<script lang="ts">
  import { fade } from 'svelte/transition';
  import { siteConfig } from '$config/site';
  import ArticleList from '$lib/components/article_list.svelte';

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

<main class="max-w-3xl mx-auto px-4 py-8" in:fade={{ duration: 300, delay: 300 }} out:fade={{ duration: 300 }}>
  <header class="mb-8 pb-4 border-b-2 border-black dark:border-white">
    <p class="text-sm uppercase tracking-wide opacity-70 mb-1"><a class="link" href="/categories">Categories</a></p>
    <h1 class="text-4xl font-bold mb-2">{data.category.name}</h1>
    <p class="text-lg opacity-80">
      {data.total}
      {data.total === 1 ? 'article' : 'articles'}
    </p>
  </header>

  <ArticleList posts={data.posts} pageNumber={data.pageNumber} totalPages={data.totalPages} {basePath} />
</main>

<!--
  A plain chronological list of articles, with a pager: the body of an author
  or category page.

  Not the homepage grid. That is a page layout driven by each story's Layout
  preset and grouped by issue; an archive of one writer's or one section's
  work wants dates and headlines in order, and a Lead from 2024 should not
  take up half the screen here because it did on its own front page.
-->
<script lang="ts">
  import type { Post } from '$lib/types/post';
  import { siteConfig } from '$config/site';

  let {
    posts,
    pageNumber,
    totalPages,
    basePath,
  }: { posts: Post.Post[]; pageNumber: number; totalPages: number; basePath: string } = $props();

  const dateFormat = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: siteConfig.timeZone,
  });

  const pageHref = (n: number) => `${basePath}${n > 1 ? `?page=${n}` : ''}`;
</script>

<ol class="h-feed flex flex-col gap-8">
  {#each posts as post (post.slug)}
    <li class="h-entry flex gap-4 items-start">
      <div class="flex-1 min-w-0">
        <time class="dt-published block text-sm opacity-70 mb-1" datetime={post.published}>
          {dateFormat.format(new Date(post.published))}
        </time>
        <h2 class="text-2xl font-bold leading-tight mb-2">
          <a class="u-url p-name link" href={post.slug}>{post.title}</a>
        </h2>
        {#if post.summary_html}
          <div class="p-summary opacity-90">{@html post.summary_html}</div>
        {:else if post.summary}
          <p class="p-summary opacity-90">{post.summary}</p>
        {/if}
      </div>
      {#if post.thumbnail ?? post.cover}
        <img
          class="u-photo hidden sm:block w-40 h-28 object-cover rounded shrink-0"
          src={post.thumbnail ?? post.cover}
          alt=""
          loading="lazy" />
      {/if}
    </li>
  {/each}
</ol>

{#if totalPages > 1}
  <nav
    class="flex justify-between items-center mt-10 pt-4 border-t border-black/20 dark:border-white/20"
    aria-label="Pages">
    {#if pageNumber > 1}
      <a class="link" rel="prev" href={pageHref(pageNumber - 1)}>← Newer</a>
    {:else}
      <span></span>
    {/if}
    <span class="text-sm opacity-70">Page {pageNumber} of {totalPages}</span>
    {#if pageNumber < totalPages}
      <a class="link" rel="next" href={pageHref(pageNumber + 1)}>Older →</a>
    {:else}
      <span></span>
    {/if}
  </nav>
{/if}

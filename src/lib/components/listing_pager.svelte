<!--
  Newer / Older links under an author or category listing. `?page=1` is never
  linked: the loaders redirect it to the bare path.
-->
<script lang="ts">
  let { pageNumber, totalPages, basePath }: { pageNumber: number; totalPages: number; basePath: string } = $props();

  const pageHref = (n: number) => `${basePath}${n > 1 ? `?page=${n}` : ''}`;
</script>

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

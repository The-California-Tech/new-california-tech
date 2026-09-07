<script lang="ts">
  import { fly } from 'svelte/transition';
  import { siteConfig } from '$config/site';

  import IndexPosts from '$lib/components/index_posts.svelte';

  let { data } = $props();

  const posts = $derived(data.posts ?? []);
  const issueDate = $derived(data.issueDate ?? '');
  const issueLabel = $derived(data.issueLabel || issueDate);
  const isFilterMode = $derived(Boolean(data.query || data.tag));

  const pdfHref = $derived(`/issues/${issueDate}.pdf`);
  const canonical = $derived(new URL(`issues/${issueDate}`, `${siteConfig.url}/`).href);

  /**
   * A bounded page, so there is no sentinel, no load-more and no scroll
   * listener rewriting the URL. See the note in +page.server.ts for why the
   * infinite feed that used to live here moved back to `/`.
   */
</script>

<svelte:head>
  <title>{issueLabel} · {siteConfig.title}</title>
  <meta name="description" content={`Articles from the ${issueLabel} issue of ${siteConfig.title}.`} />
  <!-- The feed on `/` overlaps this page's articles; name a canonical so the
       issue page is the indexed one for this date. -->
  <link rel="canonical" href={canonical} />
</svelte:head>

<div
  itemscope
  itemtype="https://schema.org/PublicationIssue"
  class="flex justify-center items-start max-w-[90rem] mx-auto px-4">
  <div
    in:fly|global={{ y: 100, duration: 300, delay: 300 }}
    out:fly|global={{ y: -100, duration: 300 }}
    class="h-feed min-h-[50vh] w-full">
    <header class="issue-header">
      <a href="/issues" class="issue-breadcrumb">← All issues</a>
      <h1 class="issue-heading" itemprop="name">{issueLabel}</h1>
      {#if data.total > 0 && data.position > 0}
        <p class="issue-meta">Issue {data.position} of {data.total}</p>
      {/if}
      {#if data.hasPdf}
        <a href={pdfHref} class="issue-pdf-link" target="_blank" rel="noopener noreferrer">Open the full PDF</a>
      {/if}
    </header>

    {#if posts.length > 0}
      <IndexPosts {posts} separateByIssueDate={false} showDateInCard={isFilterMode} />
    {:else if data.filteredEmpty}
      <div class="issue-empty">
        <h2 class="text-2xl">No articles in this issue match your filter</h2>
        <a href={`/issues/${issueDate}`} class="issue-link">Clear the filter</a>
      </div>
    {:else if data.hasPdf}
      <!-- A PDF-only archive issue: it predates the website, so there are no
           article pages to list. These used to be unreachable entirely, since
           the old nearest_issue_date lookup ignored the archive datasource. -->
      <div class="issue-empty">
        {#if data.cover}
          <a href={pdfHref} target="_blank" rel="noopener noreferrer">
            <img src={data.cover} alt={`Cover of the ${issueLabel} issue`} class="issue-cover" decoding="async" />
          </a>
        {/if}
        <p class="op-70">This issue is available as a PDF.</p>
        <a href={pdfHref} class="issue-link" target="_blank" rel="noopener noreferrer">Open the PDF</a>
      </div>
    {:else}
      <div class="issue-empty">
        <h2 class="text-2xl">No articles found for this issue</h2>
      </div>
    {/if}

    <nav class="issue-nav" aria-label="Issue navigation">
      {#if data.older}
        <a href={`/issues/${data.older.date}`} rel="prev" class="issue-nav-link">
          <span class="issue-nav-label">← Older issue</span>
          <span class="issue-nav-date">{data.older.label}</span>
        </a>
      {:else}
        <span></span>
      {/if}

      {#if data.newer}
        <a href={`/issues/${data.newer.date}`} rel="next" class="issue-nav-link issue-nav-right">
          <span class="issue-nav-label">Newer issue →</span>
          <span class="issue-nav-date">{data.newer.label}</span>
        </a>
      {/if}
    </nav>
  </div>
</div>

<style lang="scss">
  .issue-header {
    --at-apply: 'flex flex-col gap-1 mb-6 pb-4 border-b-1';
    border-color: var(--qwer-border-color);
  }

  .issue-breadcrumb {
    --at-apply: 'text-sm font-semibold no-underline w-fit';
    color: var(--qwer-text-color);

    &:hover {
      color: var(--qwer-title-hover-color);
    }
  }

  .issue-heading {
    --at-apply: 'text-3xl font-bold m-0';
    color: var(--qwer-title-color);
  }

  .issue-meta {
    --at-apply: 'text-sm op-70 m-0';
  }

  .issue-pdf-link,
  .issue-link {
    --at-apply: 'text-sm font-semibold underline underline-offset-4 w-fit';
    color: var(--qwer-title-color);

    &:hover {
      color: var(--qwer-title-hover-color);
    }
  }

  .issue-empty {
    --at-apply: 'min-h-[20rem] flex flex-col items-center justify-center gap-3 text-center';
  }

  .issue-cover {
    --at-apply: 'max-h-[28rem] w-auto border-1';
    border-color: var(--qwer-border-color);
  }

  .issue-nav {
    --at-apply: 'grid grid-cols-2 gap-4 mt-10 pt-6 border-t-1';
    border-color: var(--qwer-border-color);
  }

  .issue-nav-link {
    --at-apply: 'flex flex-col gap-1 no-underline';
    color: var(--qwer-text-color);

    &:hover .issue-nav-date {
      color: var(--qwer-title-hover-color);
    }
  }

  .issue-nav-right {
    --at-apply: 'text-right';
  }

  .issue-nav-label {
    --at-apply: 'text-xs uppercase tracking-wide op-70';
  }

  .issue-nav-date {
    --at-apply: 'font-semibold';
    color: var(--qwer-title-color);
  }
</style>

<!--
  Authors as links to their /authors pages, comma-separated.

  `microformats` marks each one up as a p-author h-card. Only the article page
  wants that: there the h-cards sit inside the article's h-entry and say who
  wrote it. On a feed card there is no h-entry around them, so they would be
  dozens of free-floating h-cards on the homepage -- which muddies what a
  parser takes as the page's own representative h-card.

  A name that slugs to nothing (all punctuation) renders unlinked rather than
  linking nowhere.
-->
<script lang="ts">
  import { authorPath } from '$lib/utils/authors';

  let { authors, microformats = false }: { authors: string[]; microformats?: boolean } = $props();
</script>

{#each authors as author (author)}
  {@const href = authorPath(author)}
  <span class="author-name" class:p-author={microformats} class:h-card={microformats}>
    <svelte:element
      this={href ? 'a' : 'span'}
      class="author-link"
      class:p-name={microformats}
      class:u-url={microformats && !!href}
      rel={href && microformats ? 'author' : undefined}
      {href}>
      {author}
    </svelte:element>
  </span>
{/each}

<style>
  /* The separator is CSS, not markup: prettier would otherwise break a literal
     comma onto its own line, and Svelte renders that as "Name , Name". The
     space lives here too, because Svelte 5 drops whitespace between {#each}
     iterations; `pre` keeps it from collapsing. */
  .author-name:not(:last-child)::after {
    content: ', ';
    white-space: pre;
  }

  /* Bylines are not body links: no colour change, underline on hover only. */
  .author-link {
    color: inherit;
    text-decoration: none;
  }

  a.author-link:hover {
    text-decoration: underline;
  }
</style>

<script lang="ts">
  import { fade } from 'svelte/transition';

  let { data } = $props();

  // Grouped by initial for scanning. Anything that does not start with a Latin
  // letter (a pen name opening with a digit, a name in another script) goes
  // under '#', so no one is dropped for not fitting A-Z.
  const groups = $derived.by(() => {
    const byLetter: Record<string, typeof data.authors> = {};
    for (const author of data.authors) {
      const initial = author.name
        .normalize('NFKD')
        .replace(/\p{M}+/gu, '')
        .charAt(0)
        .toUpperCase();
      const key = /[A-Z]/.test(initial) ? initial : '#';
      (byLetter[key] ??= []).push(author);
    }
    return Object.entries(byLetter).sort(([a], [b]) => (a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b)));
  });
</script>

<svelte:head>
  <title>Writers | The California Tech</title>
  <meta name="description" content="Everyone who has written for The California Tech, and what they wrote." />
</svelte:head>

<main class="max-w-5xl mx-auto px-4 py-8" in:fade={{ duration: 300, delay: 300 }} out:fade={{ duration: 300 }}>
  <header class="mb-8 pb-4 border-b-2 border-black dark:border-white">
    <h1 class="text-4xl font-bold mb-2">Writers</h1>
    <p class="text-lg opacity-80">
      Everyone who has written for the <em>Tech</em>
      online.
    </p>
  </header>

  {#if data.authors.length === 0}
    <p class="text-center text-lg opacity-60">No writers found.</p>
  {:else}
    <nav class="flex flex-wrap gap-2 mb-8" aria-label="Jump to letter">
      {#each groups as [letter] (letter)}
        <a class="link px-1" href="#letter-{letter === '#' ? 'other' : letter}">{letter}</a>
      {/each}
    </nav>

    {#each groups as [letter, authors] (letter)}
      <section class="mb-8" id="letter-{letter === '#' ? 'other' : letter}">
        <h2 class="text-2xl font-bold mb-3 pb-1 border-b border-black/20 dark:border-white/20">{letter}</h2>
        <ul class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
          {#each authors as author (author.slug)}
            <li class="flex items-baseline justify-between gap-2">
              <a class="link" href="/authors/{encodeURIComponent(author.slug)}">{author.name}</a>
              <span class="text-sm opacity-60 shrink-0">
                {author.articleCount}
                {author.articleCount === 1 ? 'article' : 'articles'}
              </span>
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  {/if}
</main>

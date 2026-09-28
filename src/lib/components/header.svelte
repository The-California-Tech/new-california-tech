<!-- packages/california-tech/src/lib/components/header.svelte -->
<script lang="ts">
  import Masthead from '$lib/components/masthead.svelte';
  import ScrollButtons from '$lib/components/scroll_buttons.svelte';
  import DefaultNav from '$lib/components/header/DefaultNav.svelte';
  import { page } from '$app/stores';

  // Not on /submit: it floats over the bottom-right of the editor, and a long
  // piece being written is exactly when a stray jump to the top loses your place.
  const showScrollButtons = $derived($page.url.pathname !== '/submit');
</script>

<header id="header" class="w-screen z-40" aria-label="Header Navigation">
  <Masthead />

  <!-- Simple navigation bar -->
  <nav class="relative py-2 min-h-4rem max-h-16" aria-label="Main navigation">
    <DefaultNav />
  </nav>
</header>

{#if showScrollButtons}
  <ScrollButtons />
{/if}

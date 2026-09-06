<script lang="ts">
  import { dev } from '$app/environment';
  import { headConfig, siteConfig } from '$config/site';
</script>

<svelte:head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" media="(prefers-color-scheme: dark)" content="black" />

  <link rel="apple-touch-icon" href="/favicon.png" type="image/png" />
  <link rel="shortcut icon" href="/favicon.png" type="image/png" />

  <!--
    Removed: a hex-escaped <meta name="generator"> that decoded to
    "gh:kwchang0831/svelte-QWER" -- the upstream theme author's repo, emitted on
    every page of the paper. The theme's license is honoured in LICENSE; a
    site-wide obfuscated backlink is not something the Tech should publish.
  -->
  <link rel="manifest" crossorigin="use-credentials" href="/manifest.webmanifest" />
  <link rel="alternate" type="application/feed+json" href="/feed.json" />
  <link rel="alternate" type="application/atom+xml" href="/atom.xml" />
  <link rel="sitemap" type="application/xml" href="/sitemap.xml" />

  {#if headConfig.me}
    {#each headConfig.me as href}
      <link rel="me" {href} />
    {/each}
  {/if}

  {#if headConfig.custom}
    {#each headConfig.custom({ dev }) as tag}
      {#if tag}{@html tag}{/if}
    {/each}
  {/if}
</svelte:head>

<!--
  An article's categories, each linking to its /categories page.

  These used to link to `/?tags=<name>` -- plural -- while the homepage only
  ever read `?tag=`, so every tag on every article page led to the unfiltered
  front page. The Atom feed had the same bug and was fixed separately.

  Tags arrive as plain strings from post-converter. The object and nested-array
  shapes this component also accepted were QWER's tag categories, which the
  Tech never used.
-->
<script lang="ts">
  import { categoryPath } from '$lib/utils/categories';

  let { tags = [] }: { tags?: unknown[] } = $props();

  const links = $derived(
    tags
      .filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
      .map((name) => ({ name, href: categoryPath(name) }))
      .filter((tag): tag is { name: string; href: string } => tag.href !== null),
  );
</script>

{#if links.length}
  <div class="divider"></div>

  <div class="flex gap-x-2 mx8 flex-wrap">
    {#each links as tag (tag.href)}
      <a class="btn btn-ghost" rel="tag" href={tag.href}>#{tag.name}</a>
    {/each}
  </div>
{/if}

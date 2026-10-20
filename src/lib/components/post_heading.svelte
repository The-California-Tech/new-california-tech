<!--
  The article's head, set like a homepage card (index_post.svelte) at its
  narrowest: the headline, then everything about the piece in one centred
  block -- byline, sections, date -- closed off by a short rule, and only then
  the text. Nothing about the article sits after it any more; the tags that
  used to trail the body as #hashtag buttons are the sections line here.

  The sections are told apart from the byline by type rather than by a `#`:
  italic, slightly muted, divided by thin bars rather than commas. Each
  links to its category page, and is marked up as a p-category so the h-entry
  still carries them.
-->
<script lang="ts">
  import type { Post } from '#lib/types/post.d.ts';
  import { dateConfig, siteConfig } from '#config/site.ts';
  import ImgZoom from '#lib/components/image_zoom.svelte';
  import tippy from '#lib/actions/tippy.ts';
  import { lastUpdatedStr, defaultUpdatedStr } from '#lib/utils/timeFormat.ts';
  import { strings } from '#lib/strings.ts';
  import AuthorLinks from '#lib/components/author_links.svelte';
  import { categoryPath } from '#lib/utils/categories.ts';

  let { data }: { data: Post.Post } = $props();
  // Off by default -- see post-converter. Opt in per article with coverInPost.
  const showCoverInPost = $derived(data.coverInPost ?? false);

  const sections = $derived(
    (data.tags ?? [])
      .filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
      .map((name) => ({ name, href: categoryPath(name) })),
  );

  const dayFormat = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: siteConfig.timeZone,
  });
  const exactFormat = (iso: string) =>
    new Date(iso).toLocaleString(dateConfig.toPublishedString.locales, {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      timeZone: siteConfig.timeZone,
    });

  const publishedDay = $derived(dayFormat.format(new Date(data.published)));
  // A re-sync touches `updated` without anyone changing a word, so a same-day
  // update says nothing worth a line.
  const showUpdated = $derived(Boolean(data.updated) && dayFormat.format(new Date(data.updated)) !== publishedDay);
</script>

<header class="post-heading">
  <a class="hidden u-url u-uid" href={new URL(data.slug, siteConfig.url).href}>
    {new URL(data.slug, siteConfig.url).href}
  </a>

  <h1 itemprop="name headline" class="p-name headline">{data.title}</h1>

  <!--
    One h-card per author, each linking to that writer's page; see
    author_links.svelte for why these are the writers' own URLs.
  -->
  <div class="metadata">
    {#if data.authors && data.authors.length > 0}
      <p class="author"><AuthorLinks authors={data.authors} microformats /></p>
    {/if}

    {#if sections.length}
      <p class="sections">
        {#each sections as section (section.name)}
          <svelte:element
            this={section.href ? 'a' : 'span'}
            class="section p-category"
            rel={section.href ? 'tag' : undefined}
            href={section.href}>
            {section.name}
          </svelte:element>
        {/each}
      </p>
    {/if}

    <p class="dates">
      <time
        use:tippy
        class="dt-published"
        aria-label="{strings.FirstPublishedAt()} {exactFormat(data.published)}"
        datetime={data.published}
        itemprop="datePublished">
        {publishedDay}
      </time>
      <time class="hidden dt-updated" datetime={data.updated} itemprop="dateModified">
        {defaultUpdatedStr(data.updated)}
      </time>
      {#if showUpdated}
        <span class="sep" aria-hidden="true">·</span>
        <span use:tippy aria-label="{strings.LastUpdatedAt()} {exactFormat(data.updated)}">
          Updated {lastUpdatedStr(data.updated)}
        </span>
      {/if}
    </p>
  </div>

  {#if data.cover && showCoverInPost}
    <div class="cover">
      <ImgZoom src={data.cover} class="w-full h-auto aspect-auto object-cover" loading="eager">
        {#if data.coverCaption}
          {@html data.coverCaption}
        {/if}
      </ImgZoom>
    </div>
  {/if}
</header>

<style lang="scss">
  .post-heading {
    --at-apply: 'flex flex-col pt-8 px-8';
  }

  /* The card headline, at article size: bold, ranged left, tight. */
  .headline {
    --at-apply: 'text-3xl md:text-4xl font-bold m-0 mb-4';
    line-height: 1.15;
    text-wrap: balance;
  }

  /* The card's stacked byline: centred, closed by a short rule. */
  .metadata {
    --at-apply: 'flex flex-col items-center gap-1 pb-3 mb-6';
    position: relative;
    text-align: center;
    line-height: 1.4;

    p {
      margin: 0;
    }

    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 60%;
      max-width: 10rem;
      height: 1px;
      background: var(--qwer-text-color);
    }
  }

  .author {
    --at-apply: 'font-600 text-lg';
  }

  .sections {
    font-size: 0.95rem;
  }

  /*
   * Section labels, not words in a sentence: italic, so they read as a
   * different kind of thing from the bold byline above and the dates below.
   * Separated by a thin bar rather than commas, which would read as a list
   * of names.
   */
  .section {
    font-style: italic;
    color: inherit;
    text-decoration: none;
    opacity: 0.75;

    &:not(:last-child)::after {
      content: '|';
      display: inline-block;
      margin: 0 0.6em;
      opacity: 0.45;
      font-style: normal;
    }
  }

  a.section:hover {
    opacity: 1;
    text-decoration: underline;
    text-underline-offset: 0.2em;
  }

  .dates {
    --at-apply: 'text-sm op-70';
  }

  .sep {
    margin: 0 0.4em;
    opacity: 0.55;
  }

  .cover {
    --at-apply: 'mb-6';
  }
</style>

<script lang="ts">
  import type { Post } from '$lib/types/post';
  import { dateConfig, siteConfig } from '$config/site';
  import ImgZoom from '$lib/components/image_zoom.svelte';
  import tippy from '$lib/actions/tippy';
  import { lastUpdatedStr, defaultPublishedStr, defaultUpdatedStr } from '$lib/utils/timeFormat';
  import { strings } from '$lib/strings';
  import AuthorLinks from '$lib/components/author_links.svelte';

  let { data }: { data: Post.Post } = $props();
  // Off by default -- see post-converter. Opt in per article with coverInPost.
  const showCoverInPost = $derived(data.coverInPost ?? false);
</script>

<div class="flex flex-col pt8 mx8">
  <div class="flex justify-between items-center mx--4 md:mx0">
    <a class="hidden u-url u-uid" href={new URL(data.slug, siteConfig.url).href}>
      {new URL(data.slug, siteConfig.url).href}
    </a>
    <!--
      One h-card per author, each linking to that writer's page. These used to
      be <a rel="author" class="u-url u-uid" href={siteConfig.url}>, which to a
      microformats parser asserted that every writer's identity URL was the
      paper's homepage. Now the URL really is theirs; see author_links.svelte.

      The avatar that sat here was QWER's personal-blog author photo. The Tech
      sets no siteConfig.author, so it rendered its fallback -- a GitHub logo --
      beside every byline, marked up as that author's u-photo.
    -->
    <div class="flex items-center gap-1 pl-0 shrink-0">
      {#if data.authors && data.authors.length > 0}
        <span class="font-bold text-base">
          <AuthorLinks authors={data.authors} microformats />
        </span>
      {/if}
    </div>
    <div class="flex flex-col gap1 text-right text-sm font-semibold op80">
      <time
        use:tippy
        class="dt-published"
        aria-label="{strings.FirstPublishedAt()} {new Date(data.published).toLocaleString(
          dateConfig.toPublishedString.locales,
          {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            timeZone: `${siteConfig.timeZone}`,
          },
        )}"
        datetime={data.published}
        itemprop="datePublished">
        {defaultPublishedStr(data.published)}
      </time>
      <time class="hidden dt-updated" datetime={data.updated} itemprop="dateModified">
        {defaultUpdatedStr(data.updated)}
      </time>
      <span
        use:tippy
        aria-label="{strings.LastUpdatedAt()} {new Date(data.updated).toLocaleString(
          dateConfig.toPublishedString.locales,
          {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            timeZone: `${siteConfig.timeZone}`,
          },
        )}">
        {strings.Updated()}
        {lastUpdatedStr(data.updated)}
      </span>
    </div>
  </div>

  <h1 itemprop="name headline" class="p-name text-4xl my4 mx--4 md:mx0">{data.title}</h1>

  <div class="mx--8 md:mx0">
    {#if data.cover && showCoverInPost}
      <ImgZoom
        src={data.cover}
        class="w-full h-auto aspect-auto object-cover md:(rounded-2xl shadow-xl)"
        loading="eager">
        {#if data.coverCaption}
          {@html data.coverCaption}
        {/if}
      </ImgZoom>
    {/if}
  </div>
</div>

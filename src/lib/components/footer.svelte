<!-- packages/california-tech/src/lib/components/footer.svelte -->
<script lang="ts">
  import { siteConfig } from '#config/site.ts';
  import { fly } from 'svelte/transition';
  import tippy from '#lib/actions/tippy.ts';
  import { strings } from '#lib/strings.ts';

  let className: string | undefined = undefined;
  export { className as class };

  const sinceYear = siteConfig.since ? siteConfig.since.toString() : undefined;
  const curYear = new Date().toJSON().substring(0, 4);
  const copyrightYear = `${sinceYear && sinceYear !== curYear ? `${sinceYear}-${curYear}` : `${curYear}`}`;
</script>

<footer
  id="footer"
  in:fly|global={{ y: 100, duration: 1200, delay: 900 }}
  out:fly|global={{ y: 100, duration: 300 }}
  class="flex flex-col justify-center items-center flex-none w-full mx-auto xl:mx-0 {className ?? ''}">
  <main class="rounded-b-2xl pb6 my4 gap1 flex flex-col justify-center items-center md:(border-t-2 w-3xl mt-8)">
    <div class="flex justify-center mt-4">
      <a
        use:tippy
        href="/atom.xml"
        class="btn btn-ghost"
        aria-label="Atom Feed"
        data-sveltekit-preload-data="false"
        data-sveltekit-reload>
        <div class="!w-[1.75rem] !h-[1.75rem] i-ic-baseline-rss-feed"></div>
      </a>
      <a
        use:tippy
        href="/sitemap.xml"
        class="btn btn-ghost"
        aria-label="Sitemap"
        data-sveltekit-preload-data="false"
        data-sveltekit-reload>
        <div class="!w-[1.75rem] !h-[1.75rem] i-mdi-sitemap-outline"></div>
      </a>
    </div>
    <!--
      On every page, as Caltech requires of externally hosted sites: the
      official Caltech Privacy Notice, and the hosting provider's. The site's
      own notice (/privacy) covers the rest and links every other service.
    -->
    <nav class="privacy-links" aria-label="Privacy">
      <a href="/privacy">Privacy</a>
      <a href="https://www.caltech.edu/privacy-notice" rel="external">Caltech Privacy Notice</a>
      <a href="https://vercel.com/legal/privacy-policy" rel="external">Vercel Privacy Notice</a>
    </nav>
    <p itemprop="copyrightNotice">
      Copyright © <span itemprop="copyrightYear">{copyrightYear}</span>
      <span itemprop="copyrightHolder">{siteConfig.title}</span>
    </p>
    <div class="">
      Powered by
      <a use:tippy aria-label="Built with SvelteKit" rel="external" href="https://kit.svelte.dev" class="font-900">
        SvelteKit
      </a>
    </div>
  </main>
</footer>

<style lang="scss">
  #footer main {
    background-color: var(--qwer-bg-color);
    color: var(--qwer-text-color);
    border-top-color: var(--qwer-border-top-color);
  }
  .privacy-links {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.25rem 0;
    a {
      text-decoration: underline;
      text-underline-offset: 0.15em;
    }
    a:not(:last-child)::after {
      content: '·';
      display: inline-block;
      margin: 0 0.6em;
      opacity: 0.55;
      text-decoration: none;
    }
  }
  #footer a:not(.btn) {
    &:hover {
      color: var(--qwer-link-hover-color);
    }
  }
</style>

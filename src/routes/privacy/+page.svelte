<!--
  The site's own privacy notice: what this website collects, on top of the
  Caltech Privacy Notice, which also applies. Linked from every page's footer
  and from /submit.

  Written to match what the code does, so it has to change with it. The facts
  it states, and where each comes from:
    - one cookie, `theme`: routes/api/toggle-theme (also kept in localStorage
      by stores/themes.ts)
    - the /submit draft in localStorage: components/submit/draft.ts
    - analytics: @vercel/analytics and @vercel/speed-insights, injected in
      routes/+layout.ts with /share/ links scrubbed; neither package touches
      cookies or storage (checked in their dist, October 2026)
    - /submit: server/submission.ts and server/submission-mail.ts
    - embeds: Crosshare (utils/embeds.ts) and Tally (the /hello page)
  Adding a cookie, a tracker, an embed provider or a form field means
  updating this page.
-->
<script lang="ts">
  import { fade } from 'svelte/transition';
  import '#lib/styles/prose.scss';
  import { techConfig } from '#config/tech.ts';

  const CALTECH_PRIVACY_NOTICE = 'https://www.caltech.edu/privacy-notice';
  const UPDATED = 'November 2, 2026';

  const services = [
    { name: 'Vercel', role: 'hosts the website and its analytics', href: 'https://vercel.com/legal/privacy-policy' },
    {
      name: 'Supabase',
      role: 'stores articles, images and submissions',
      href: 'https://supabase.com/privacy',
    },
    {
      name: 'Notion',
      role: 'the editors’ workspace, where submissions are reviewed',
      href: 'https://www.notion.so/notion/Privacy-Policy-3468d120cf614d4c9014c09f6adc9091',
    },
    {
      name: 'Google (Gmail)',
      role: 'sends submission confirmations from the Tech’s email account',
      href: 'https://policies.google.com/privacy',
    },
    { name: 'Crosshare', role: 'crossword puzzles embedded in some articles', href: 'https://crosshare.org/privacy' },
    { name: 'Tally', role: 'survey forms embedded on some pages', href: 'https://tally.so/help/privacy-policy' },
  ];
</script>

<svelte:head>
  <title>Privacy | The California Tech</title>
  <meta name="description" content="What The California Tech’s website collects, and how it is used." />
</svelte:head>

<main class="max-w-3xl mx-auto px-4 py-8" in:fade={{ duration: 300, delay: 300 }} out:fade={{ duration: 300 }}>
  <header class="mb-8 pb-4 border-b-2 border-black dark:border-white">
    <h1 class="text-4xl font-bold mb-2">Privacy</h1>
    <p class="text-sm opacity-70">Last updated {UPDATED}</p>
  </header>

  <!--
    prettier-ignore: Prettier's HTML formatting here moves punctuation after
    an inline element (`</a>,`) onto its own line, and Svelte renders that line
    break as a space before the comma.
  -->
  <!-- prettier-ignore -->
  <div class="prose prose-slate dark:prose-invert max-w-none privacy-body">
    <p>
      <em>The California Tech</em> is Caltech’s student newspaper. This page explains what its website collects
      and why. It supplements the <a href={CALTECH_PRIVACY_NOTICE} rel="external">Caltech Privacy Notice</a>,
      which also applies.
    </p>

    <h2>Reading the site</h2>
    <p>
      You don’t need an account, and there are no ads or tracking cookies. The site sets one cookie, “theme”,
      which remembers whether you chose the light or dark theme. It lasts a year and contains nothing else. Your
      browser also keeps that choice in its local storage.
    </p>
    <p>
      We count visits with Vercel Web Analytics and measure page speed with Vercel Speed Insights. For each page
      view they record the page’s address, the referring page, your browser, operating system and device type,
      approximate location (country, region and city), and page-load timings. They use no cookies or browser
      storage. Vercel tells visits apart using a hash of the request that it discards after 24 hours, and does not
      link these records to your IP address or follow you across other sites. Private edit links are removed
      before anything is sent.
    </p>
    <p>
      Like any website, the servers that deliver these pages (Vercel, and Supabase for articles and images)
      receive your IP address and browser details with each request, and keep standard logs under their own
      policies.
    </p>

    <h2>Submitting a piece</h2>
    <p>
      The <a href="/submit">submission form</a> asks for your name, your Caltech email address, a title, a
      category and your text, and lets you add images. We use them to review, edit and possibly publish your
      piece, and to contact you about it.
    </p>
    <ul>
      <li>
        Your submission is stored in Notion, the editors’ workspace, and in Supabase. Your name and email are kept
        in an internal note for the editors. They are not published, and you are credited as the author only if
        the piece runs under your name.
      </li>
      <li>
        Images are re-encoded when you upload them, which removes location and other camera metadata. They are
        kept at unlisted addresses until the piece is published.
      </li>
      <li>
        You get a confirmation email, and the editors get a notice with your name, email and title, sent from the
        <em>Tech</em>’s Gmail account.
      </li>
      <li>Nothing is public until an editor publishes it.</li>
      <li>
        While you write, your draft is saved only in your browser’s local storage, so it survives a reload. It is
        not sent anywhere until you press Submit, and it is cleared afterwards.
      </li>
      <li>
        To limit spam, the site counts submissions per IP address. The count is held in memory for up to an hour
        and not stored.
      </li>
    </ul>
    <p>
      To correct or delete a submission, email <a href="mailto:{techConfig.email}">{techConfig.email}</a>.
    </p>

    <h2>Embedded content</h2>
    <p>
      Some articles embed crossword puzzles from Crosshare, and some pages embed survey forms from Tally. These
      load from those sites, are covered by their own privacy policies, and may set their own cookies. Anything
      you type into an embedded form goes to that service.
    </p>

    <h2>Services we use</h2>
    <ul>
      {#each services as service (service.name)}
        <li><a href={service.href} rel="external">{service.name}</a>: {service.role}</li>
      {/each}
    </ul>

    <h2>Questions</h2>
    <p>
      Write to the editors at <a href="mailto:{techConfig.email}">{techConfig.email}</a>. For Caltech’s own
      privacy practices, or to contact Caltech’s privacy office, see the
      <a href={CALTECH_PRIVACY_NOTICE} rel="external">Caltech Privacy Notice</a>.
    </p>
  </div>
</main>

<style>
  /* The shared prose styles pad the text in from the heading above it. */
  .privacy-body {
    padding-inline: 0;
  }
</style>

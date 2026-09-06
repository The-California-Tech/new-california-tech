import type { Site } from '$lib/types/site';
import type { DD } from '$lib/types/dd';

import SiteCover from '$assets/qwer.webp';

export const siteConfig: Site.Config = {
  url: 'https://tech.caltech.edu',
  title: 'The California Tech',
  subtitle: 'Independent student newspaper of Caltech',
  description: 'The California Tech: news, analysis, and features from the Caltech community.',
  lang: 'en',
  timeZone: 'US/Pacific',
  since: 2022,
  indexLayout: 'posts-only', // Options: 'default', 'posts-only', 'profile-only', 'custom'
  cover: SiteCover
};

/**
 * Extra <head> tags, injected via {@html} in src/lib/components/head.svelte.
 *
 * Analytics is handled by Vercel Analytics + Speed Insights, wired up in
 * src/routes/+layout.ts. Both are first-party proxied on Vercel, so they need no
 * entry here and no third-party origin in the CSP.
 *
 * Removed 2026-09: a Google Analytics tag for property G-LQ73GWF6XT, inherited
 * verbatim from the upstream QWER theme (it sat under a "Replace the following
 * with your own setting" comment, beside a commented-out Plausible endpoint
 * pointing at svelte-qwer.vercel.app). It was almost certainly the theme
 * author's property, not the Tech's. It never actually ran either: the tags were
 * emitted as type="text/partytown" while Partytown was disabled, so browsers
 * ignored them as an unknown script type.
 *
 * If the Tech ever wants GA, add it here as a normal <script> with the paper's
 * own measurement ID, and add https://www.googletagmanager.com back to
 * script-src in vercel.json.
 */
export const headConfig: Site.Head = {
  custom: ({ dev }) => (dev ? [] : []),
};

export const dateConfig: Site.DateConfig = {
  toPublishedString: {
    locales: 'en-US',
    options: {
      year: 'numeric',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: `${siteConfig.timeZone}`,
    },
  },
  toUpdatedString: {
    locales: 'en-US',
    options: {
      year: 'numeric',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: `${siteConfig.timeZone}`,
    },
  },
};

export const navConfig: Array<DD.Nav | DD.Link> = [
  {
    name: 'Menu',
    orientation: 2,
    links: [
      {
        name: 'Home',
        url: '/',
      },
      {
        name: 'Issues',
        url: '/issues',
      },
      {
        name: 'Feed',
        url: '/atom.xml',
      }
    ],
  },
  {
    name: 'Archives',
    url: '/issues',
  },
  {
    name: 'Contact',
    url: 'mailto:tech@caltech.edu',
    rel: 'external',
  }
];

export const mobilenavConfig: DD.Nav = {
  orientation: 2,
  links: [
    {
      name: 'Home',
      url: '/',
    },
    {
      name: 'Issues',
      url: '/issues',
    },
    {
      name: 'Feed',
      url: '/atom.xml',
    },
    {
      name: 'Contact',
      url: 'mailto:tech@caltech.edu',
      rel: 'external',
    },
  ],
};

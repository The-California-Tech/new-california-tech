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

export const headConfig: Site.Head = {
  custom: ({ dev }) =>
    dev
      ? [
          // For Development Environment
        ]
      : [
          // For Production Environment

          // Replace the following with your own setting

          // Plausible
          // '<link rel="preconnect" href="https://plausible.kwchang0831.dev" />',
          // '<script defer type="text/partytown" data-domain="svelte-qwer.vercel.app" src="https://plausible.kwchang0831.dev/js/plausible.js"></script>',
          // Google tag (gtag.js)
          `<script type="text/partytown" src="https://www.googletagmanager.com/gtag/js?id=G-LQ73GWF6XT"></script>`,
          `<script type="text/partytown">
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-LQ73GWF6XT');
          </script>`,
        ],
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

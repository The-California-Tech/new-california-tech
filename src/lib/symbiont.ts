import { createSymbiontClient } from 'symbiont-cms';

export const SUPABASE_URL = 'https://xguzskbxiptvhbyggkpl.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_6L-isfCogfHJxcnTT9WseA_U4GUHcAB';

/**
 * The articles datasource. Named once here, beside the config entry it names,
 * for callers that pass it to SQL (listing-query.ts). syndication.ts, issues.ts
 * and server/submission.ts still each declare their own copy; folding them into
 * this one is a small cleanup that has not been done yet.
 */
export const ARTICLES_ALIAS = 'tech-article-staging';

/**
 * Symbiont CMS client for California Tech
 *
 * This is the central configuration for the CMS.
 * Import and use this client anywhere in your app (client or server).
 *
 * Read-only client configuration for SSR and public routes.
 */
export const symbiont = createSymbiontClient({
  supabase: {
    url: SUPABASE_URL,
    publishableKey: SUPABASE_PUBLISHABLE_KEY,
  },

  markdown: {
    toc: {
      enabled: true,
      minHeadingLevel: 1,
      maxHeadingLevel: 4,
    },
  },

  databases: [
    {
      alias: ARTICLES_ALIAS,
      dataSourceId: '6cc3888f-d9fa-4075-add9-b596e6fc44f3',
    },
    {
      alias: 'tech-archives',
      dataSourceId: '3061cbde-6d28-8093-96e0-000bc5d1741a',
    },
    {
      alias: 'tech-website-pages',
      dataSourceId: '3061cbde-6d28-8081-8ddb-000bbc2f76e1',
    },
  ],
});

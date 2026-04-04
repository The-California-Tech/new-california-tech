export const prerender = true;
import type { LayoutLoad } from './$types';

import { dev } from '$app/environment';
import { injectAnalytics } from '@vercel/analytics/sveltekit';
import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';

injectSpeedInsights();
injectAnalytics({ mode: dev ? 'development' : 'production' });

export const load: LayoutLoad = async ({ url }) => {
  return {
    props: {
      path: url.pathname,
    },
  };
};

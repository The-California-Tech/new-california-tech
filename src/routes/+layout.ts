export const prerender = true;
import type { LayoutLoad } from './$types';

import { dev } from '$app/environment';
import { injectAnalytics } from '@vercel/analytics/sveltekit';
import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';

/**
 * /share/<token> URLs are credentials: anyone holding one can read, or edit, an
 * unpublished piece. They must not reach analytics, which keeps every URL it
 * sees. Rewritten rather than dropped, so the route's usage is still countable.
 */
function scrubShareToken<T extends { url: string }>(event: T): T {
  const url = new URL(event.url);
  if (!url.pathname.startsWith('/share/')) return event;
  url.pathname = '/share/[token]';
  url.search = '';
  return { ...event, url: url.href };
}

injectSpeedInsights({ beforeSend: scrubShareToken });
injectAnalytics({ mode: dev ? 'development' : 'production', beforeSend: scrubShareToken });

export const load: LayoutLoad = async ({ url }) => {
  return {
    props: {
      path: url.pathname,
    },
  };
};

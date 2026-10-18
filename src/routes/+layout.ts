export const prerender = true;
import type { LayoutLoad } from './$types';

import { dev } from '$app/env';
// The `/sveltekit-next` entries are the SvelteKit 3 ones. The `/sveltekit`
// entries subscribe to `$app/stores`, which Kit 3 removed, and throw in the
// browser. Both packages are pinned to canaries (npm `beta` tag) because no
// stable release supports Kit 3 yet; when one does, check whether the entry is
// still called `sveltekit-next`.
import { injectAnalytics } from '@vercel/analytics/sveltekit-next';
import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit-next';

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

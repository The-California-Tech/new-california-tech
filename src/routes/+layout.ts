export const prerender = true;
import type { LayoutLoad } from './$types';

// Vercel Analytics / Speed Insights are started from +layout.svelte; see
// #lib/vercel-observability.ts for why not here any more.

export const load: LayoutLoad = async ({ url }) => {
  return {
    props: {
      path: url.pathname,
    },
  };
};

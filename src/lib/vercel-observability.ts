/**
 * Vercel Web Analytics and Speed Insights, wired up by hand.
 *
 * Both packages ship a `/sveltekit` entry (`injectAnalytics`,
 * `injectSpeedInsights`), and this app used them until SvelteKit 3. Those
 * entries subscribe to `page` from `$app/stores`, which Kit 3 REMOVED -- not
 * deprecated: the subscription throws in the browser on every page load. As of
 * @vercel/analytics 2.0.1 and @vercel/speed-insights 2.0.0 there is no Kit 3
 * release. When there is, this file can go back to those two calls.
 *
 * The wrappers did three things, all reproduced here on the packages'
 * framework-neutral entries:
 *   - inject the script with `framework: 'sveltekit'`;
 *   - for analytics, turn off its own History-API tracking and report a
 *     pageview per navigation with the ROUTE ID (/[slug=slug]) as well as the
 *     path, so Vercel groups articles by route;
 *   - for speed insights, keep the current route ID on the script.
 * The route comes from the root layout's afterNavigate, which also fires on
 * the first load.
 *
 * Not reproduced: the wrappers' VITE_VERCEL_OBSERVABILITY_* base-path and
 * config overrides. They were always undefined here, because vite.config.js
 * sets `envPrefix: 'QWER_'`, so no VITE_ variable ever reached the client.
 */
import { inject, pageview, type BeforeSendEvent } from '@vercel/analytics';
import { injectSpeedInsights, type BeforeSendMiddleware } from '@vercel/speed-insights';
import { dev } from '$app/env';

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

export interface VercelObservability {
  /** Report a client-side navigation. */
  navigated(routeId: string, path: string): void;
}

/** Browser only. Call once, from the root layout. */
export function startVercelObservability(initialRouteId: string | null): VercelObservability {
  inject({
    mode: dev ? 'development' : 'production',
    framework: 'sveltekit',
    disableAutoTrack: true,
    beforeSend: (event: BeforeSendEvent) => scrubShareToken(event),
  });

  const speedInsights = injectSpeedInsights({
    framework: 'sveltekit',
    route: initialRouteId ?? undefined,
    beforeSend: scrubShareToken as BeforeSendMiddleware,
  });

  return {
    navigated(routeId, path) {
      pageview({ route: routeId, path });
      speedInsights?.setRoute(routeId);
    },
  };
}

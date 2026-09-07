import adapterNode from '@sveltejs/adapter-node';
import adapterVercel from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: getAdapter(),

    // =========================================================================
    // CONTENT SECURITY POLICY -- read before changing anything CSP-related.
    //
    // There is deliberately no `csp` key here. The policy lives ONLY in
    // vercel.json. (These notes live here because vercel.json is strict JSON:
    // it has no comment syntax, and Vercel's schema validation rejects unknown
    // top-level keys outright -- a `$comment` array fails the build with
    // "should NOT have additional property `$comment`".)
    //
    // WHY kit.csp WAS REMOVED
    //   `csp: { mode: 'auto' }` used to be set here, which made SvelteKit emit
    //   a SECOND, independent CSP header alongside vercel.json's. Browsers
    //   enforce multiple CSP headers as an INTERSECTION, so the effective
    //   policy was the overlap. Worse, auto mode adds hashes/nonces, and per
    //   spec a nonce or hash in a directive causes browsers to IGNORE
    //   'unsafe-inline' in that same directive -- which blocked the
    //   hand-written inline theme bootstrap in src/app.html. SvelteKit only
    //   hashes scripts it injects itself; it does not parse app.html.
    //
    // NOTES ON THE POLICY IN vercel.json
    //   - img-src allows any https: origin on purpose. Article bodies are
    //     authored in Notion and can embed images from anywhere, so an
    //     allowlist would silently break editorial content. http: is still
    //     excluded, so no mixed content.
    //   - 'unsafe-inline' in script-src is required by the app.html theme
    //     bootstrap. Removing it means moving that script under SvelteKit's
    //     control or hashing it by hand -- worth doing, but not before launch.
    //   - Vercel Analytics and Speed Insights are first-party proxied
    //     (/_vercel/insights/*, /_vercel/speed-insights/*), so 'self' covers
    //     them in production. va.vercel-scripts.com is listed because the
    //     dev/debug build of the script loads from there;
    //     vitals.vercel-insights.com is the beacon endpoint some versions use.
    //   - No third-party analytics origins, on purpose: the inherited Google
    //     Analytics tag was removed in Sep 2026 (see user/config/site.ts). If
    //     the Tech ever adds GA with its own measurement ID, script-src needs
    //     https://www.googletagmanager.com and connect-src needs
    //     https://www.google-analytics.com.
    // =========================================================================
    alias: {
      $QWER: './QWER',
      $lib: './src/lib',
      $generated: './src/generated',
      $stores: './src/lib/stores',
      $config: './user/config',
      $assets: './user/assets',
      $custom: './user/custom',
      $static: './static',
    },
    prerender: {
      entries: ['*'],
    },
  },
};

/**
 * Adapter selection.
 *
 * This used to fall through to `adapter-static` for any non-Vercel build, which
 * could never work: every route in this app is dynamic (`prerender = false`),
 * and adapter-static hard-errors on dynamic routes. It also ignored the
 * `ADAPTER=node` that `build:sveltekit` sets, so that variable was a no-op.
 *
 * Nobody noticed because Vercel takes the first branch and `pnpm build` was
 * never run locally. CI running it is what surfaced this.
 *
 * Now: Vercel in its own build environment, adapter-node everywhere else. Both
 * produce a working server build. There is no static option because this site
 * cannot be static -- the feed, article pages and API routes all need a server.
 *
 * The VERCEL check stays as a substring scan rather than `process.env.VERCEL`
 * because that is the form that has been deploying successfully; not worth
 * changing the one path that works in order to tidy it.
 */
function getAdapter() {
  if (Object.keys(process.env).some((key) => key.includes('VERCEL'))) {
    return adapterVercel();
  }
  return adapterNode();
}

export default config;

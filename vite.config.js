import adapterNode from '@sveltejs/adapter-node';
import adapterVercel from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { sveltekit } from '@sveltejs/kit/vite';
import Unocss from 'unocss/vite';
import { presetTypography, presetIcons, presetUno } from 'unocss';
import extractorSvelte from '@unocss/extractor-svelte';
import { presetScrollbar } from 'unocss-preset-scrollbar';
import transformerDirective from '@unocss/transformer-directives';
import transformerVariantGroup from '@unocss/transformer-variant-group';
import transformerCompileClass from '@unocss/transformer-compile-class';
import { imagetools } from 'vite-imagetools';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
const pathMainPkg = fileURLToPath(new URL('package.json', import.meta.url));
const jsonMainPkg = readFileSync(pathMainPkg, 'utf8');
const pathQWERPkg = fileURLToPath(new URL('QWER/package.json', import.meta.url));
const jsonQWERPkg = readFileSync(pathQWERPkg, 'utf8');
const mainPkg = JSON.parse(jsonMainPkg);
const qwerPkg = JSON.parse(jsonQWERPkg);

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

// (Removed: `outputFolderPath`, which existed only to tell the Partytown Vite
// plugin where to copy its runtime. Partytown was dropped in Sep 2026 — the
// site's only third-party script was an inherited Google Analytics tag, and
// with that gone Partytown had nothing left to move off the main thread.)

/** @type {import('vite').UserConfig} */
export default defineConfig({
  mode: process.env.MODE || 'production',
  envPrefix: 'QWER_',
  define: {
    __VERSION_MAIN__: mainPkg,
    __VERSION_QWER__: qwerPkg,
  },
  plugins: [
    Unocss({
      extractors: [extractorSvelte()],
      presets: [
        presetUno(),
        presetScrollbar(),
        presetIcons(),
        presetTypography({
          cssExtend: {
            ':not(pre) > code::before,:not(pre) > code::after': {
              content: '',
            },
            pre: {
              'border-radius': 0,
              padding: 0,
              margin: 0,
            },
          },
        }),
      ],
      transformers: [transformerDirective(), transformerVariantGroup(), transformerCompileClass()],
      shortcuts: [
        {
          'title-link':
            'bg-gradient-to-t from-orange-500 to-orange-500 bg-no-repeat [background-position:0_88%] [background-size:0%_0.1em] focus:![background-size:100%_100%] hover:![background-size:100%_100%] group-hover:[background-size:100%_0.1em] motion-safe:transition-all motion-safe:duration-200',
        },
        [
          /^title-link-(.*)-(.*)-(.*)-(.*)$/,
          ([, f, fc, t, tc]) =>
            `bg-gradient-to-t from-${f}-${fc} to-${t}-${tc} bg-no-repeat [background-position:0_88%] [background-size:0%_0.15em] focus:![background-size:100%_100%] hover:![background-size:100%_100%] group-hover:[background-size:100%_0.15em] motion-safe:transition-all motion-safe:duration-300`,
        ],
      ],
    }),
    imagetools(),
    sveltekit({
      preprocess: vitePreprocess(),
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
      // WHY csp WAS REMOVED
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
      //
      // No `alias` either: the $lib/$config/$generated/... aliases became
      // package.json "imports" (#lib/*, #config/*, #generated/*, #assets/*),
      // which SvelteKit 3 uses instead and which plain Node understands too.
      prerender: { entries: ['*'] },
    }),
  ],
  server: {
    fs: {
      allow: ['..'],
    },
  },
});

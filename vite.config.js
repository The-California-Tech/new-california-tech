import { sveltekit } from '@sveltejs/kit/vite';
import Unocss from 'unocss/vite';
import { presetTypography, presetIcons, presetUno } from 'unocss';
import extractorSvelte from '@unocss/extractor-svelte';
import { presetScrollbar } from 'unocss-preset-scrollbar';
import transformerDirective from '@unocss/transformer-directives';
import transformerVariantGroup from '@unocss/transformer-variant-group';
import transformerCompileClass from '@unocss/transformer-compile-class';
import { imagetools } from 'vite-imagetools';
import path from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
const pathMainPkg = fileURLToPath(new URL('package.json', import.meta.url));
const jsonMainPkg = readFileSync(pathMainPkg, 'utf8');
const pathQWERPkg = fileURLToPath(new URL('QWER/package.json', import.meta.url));
const jsonQWERPkg = readFileSync(pathQWERPkg, 'utf8');
const mainPkg = JSON.parse(jsonMainPkg);
const qwerPkg = JSON.parse(jsonQWERPkg);

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
    sveltekit(),
  ],
  resolve: {
    alias: {
      $QWER: path.resolve('.', 'QWER'),
      $generated: path.resolve('.', 'src/generated'),
      $stores: path.resolve('.', 'src/lib/stores'),
      $config: path.resolve('.', 'user/config'),
      $assets: path.resolve('.', 'user/assets'),
      $custom: path.resolve('.', 'user/custom'),
      $static: path.resolve('.', 'static'),
    },
  },
  server: {
    fs: {
      allow: ['..'],
    },
  },
});

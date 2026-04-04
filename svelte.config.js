import adapterNode from '@sveltejs/adapter-node';
import adapterStatic from '@sveltejs/adapter-static';
import adapterVercel from '@sveltejs/adapter-vercel';
import adapterNetlify from '@sveltejs/adapter-netlify';
import adapterCloudflare from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: getAdapter(),
    csp: { mode: 'auto' },
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
      entries: ['*']
    }
  },
};

function getAdapter() {
  if (Object.keys(process.env).some((key) => key.includes('VERCEL'))) {
    return adapterVercel();
  } else {
    return adapterStatic({
          pages: 'build',
          assets: 'build',
          fallback: undefined,
        });
  }
}

export default config;

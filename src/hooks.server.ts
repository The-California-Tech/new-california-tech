import type { Handle } from '@sveltejs/kit/hooks';
import * as env from '$app/env/private';
import { setEnvSource } from 'symbiont-cms/server';
import { siteConfig } from '#config/site.ts';
import { sequence } from '@sveltejs/kit/hooks';

/*
 * Give symbiont the server environment. Its requireEnvVar reads process.env,
 * which Vite's dev server does not fill from .env, so under `pnpm dev` every
 * secret symbiont needed was missing (and the same code worked on Vercel).
 * $app/env/private holds the variables declared in src/env.ts, with the same
 * values in both places; symbiont still falls back to process.env for anything
 * not declared there.
 */
setEnvSource(env);

const themeHandler: Handle = async ({ event, resolve }) => {
  const theme = event.cookies.get('theme') || 'light';
  event.locals.theme = theme;

  const response = await resolve(event, {
    transformPageChunk: ({ html }) => {
      // Apply theme to both data-theme attribute AND body class
      return html.replace('data-theme="light"', `data-theme="${theme}"`).replace('<body', `<body class="${theme}"`);
    },
  });

  return response;
};

export const handle = sequence(themeHandler, async ({ event, resolve }) =>
  resolve(event, {
    transformPageChunk: ({ html }) => html.replace('<html lang="en">', `<html lang="${siteConfig.lang ?? 'en'}">`),
  }),
);

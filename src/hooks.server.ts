import type { Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { setEnvSource } from 'symbiont-cms/server';
import { siteConfig } from '$config/site';
import { sequence } from '@sveltejs/kit/hooks';

/*
 * Give symbiont the server environment. Its requireEnvVar reads process.env,
 * which Vite's dev server does not fill from .env, so under `pnpm dev` every
 * secret symbiont needed was missing (and the same code worked on Vercel).
 * $env/dynamic/private is the full environment in both places.
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

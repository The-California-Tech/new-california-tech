// packages/california-tech/src/routes/api/toggle-theme/+server.ts
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ url, cookies }) => {
  // Read current theme from cookie (default to 'light' if not set)
  const currentTheme = cookies.get('theme') || 'light';

  // Toggle: dark -> light, light -> dark
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

  // Set the new theme cookie
  cookies.set('theme', newTheme, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // One year
  });

  // Redirect back to the page the user was on -- but only on this site.
  // redirectTo comes from the query string, so anyone could link to
  // /api/toggle-theme?redirectTo=https://evil.example and use the Tech's
  // domain as a trampoline (an open redirect). SvelteKit 3 would now throw on
  // an external target; resolving against our own origin and keeping only the
  // path closes it outright, `//evil.example` included.
  throw redirect(303, sameSitePath(url.searchParams.get('redirectTo'), url.origin));
};

function sameSitePath(target: string | null, origin: string): string {
  if (!target) return '/';
  try {
    const resolved = new URL(target, origin);
    if (resolved.origin !== origin) return '/';
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return '/';
  }
}

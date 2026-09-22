import { error } from '@sveltejs/kit';
import { dev } from '$app/environment';

/**
 * Dev-only. This page exists to look at, not to ship -- it renders synthetic
 * stories so the layout presets can be compared side by side without needing
 * a particular issue to happen to contain one of each.
 */
export const prerender = false;

export function load() {
  if (!dev) {
    throw error(404, 'Not found');
  }

  return {};
}

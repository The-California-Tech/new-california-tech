import type { PageServerLoad } from './$types';
import { appDb } from '$lib/utils/app-db';
import { fetchCategories } from '$lib/utils/listing-query';

export const prerender = false;

/**
 * Every category in use, from list_categories().
 *
 * This used to fetch getAllPages({ limit: 1000 }) -- across every datasource,
 * archives and static pages included -- and count tags in JS, which silently
 * stopped counting at the thousandth row and counted tags that were never
 * article sections.
 */
export const load: PageServerLoad = async ({ fetch, setHeaders }) => {
  const categories = await fetchCategories(appDb(fetch));
  setHeaders({ 'cache-control': 'public, max-age=60, s-maxage=300' });
  return {
    // Most-used first, as before: this page is how readers find the sections.
    categories: categories
      .map(({ name, slug, articleCount }) => ({ name, slug, count: articleCount }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  };
};

import type { PageServerLoad } from './$types';
import { appDb } from '#lib/utils/app-db.ts';
import { fetchAuthors } from '#lib/utils/listing-query.ts';
import { PAGE_CACHE_CONTROL } from '#lib/utils/cache-control.ts';

export const prerender = false;

export const load: PageServerLoad = async ({ fetch, setHeaders }) => {
  const authors = await fetchAuthors(appDb(fetch));
  setHeaders({ 'cache-control': PAGE_CACHE_CONTROL });
  return {
    authors: authors.map(({ name, slug, articleCount, latestPublishAt }) => ({
      name,
      slug,
      articleCount,
      latestPublishAt,
    })),
  };
};

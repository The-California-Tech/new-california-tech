import type { PageServerLoad } from './$types';
import { appDb } from '#lib/utils/app-db.ts';
import { fetchAuthors } from '#lib/utils/listing-query.ts';

export const prerender = false;

export const load: PageServerLoad = async ({ fetch, setHeaders }) => {
  const authors = await fetchAuthors(appDb(fetch));
  setHeaders({ 'cache-control': 'public, max-age=60, s-maxage=300' });
  return {
    authors: authors.map(({ name, slug, articleCount, latestPublishAt }) => ({
      name,
      slug,
      articleCount,
      latestPublishAt,
    })),
  };
};

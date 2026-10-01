import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { appDb } from '$lib/utils/app-db';
import { authorSlug } from '$lib/utils/authors';
import { LISTING_PAGE_SIZE, fetchAuthorPosts, fetchAuthors } from '$lib/utils/listing-query';

export const prerender = false;

export const load: PageServerLoad = async ({ fetch, params, url, setHeaders }) => {
  // One URL per author. A hand-typed /authors/Mike%20O'Sullivan, or an old
  // link to a spelling since merged, lands on the canonical slug rather than
  // becoming a second copy of the page.
  const slug = authorSlug(params.author);
  if (!slug) error(404, 'Author not found');
  const pageNumber = Math.max(1, Math.floor(Number(url.searchParams.get('page') ?? 1)) || 1);
  if (slug !== params.author || url.searchParams.get('page') === '1') {
    const query = pageNumber > 1 ? `?page=${pageNumber}` : '';
    redirect(301, `/authors/${encodeURIComponent(slug)}${query}`);
  }

  const client = appDb(fetch);
  const author = (await fetchAuthors(client)).find((entry) => entry.slug === slug);
  if (!author) error(404, 'Author not found');

  const { posts, total } = await fetchAuthorPosts(client, author.names, {
    limit: LISTING_PAGE_SIZE,
    offset: (pageNumber - 1) * LISTING_PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil(total / LISTING_PAGE_SIZE));
  if (pageNumber > totalPages) error(404, 'No such page');

  setHeaders({ 'cache-control': 'public, max-age=60, s-maxage=300' });
  return { author: { name: author.name, slug }, posts, total, pageNumber, totalPages };
};

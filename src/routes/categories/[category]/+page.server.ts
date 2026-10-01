import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { appDb } from '$lib/utils/app-db';
import { categorySlug } from '$lib/utils/categories';
import { LISTING_PAGE_SIZE, fetchCategories, fetchCategoryPosts } from '$lib/utils/listing-query';

export const prerender = false;

/** The category twin of /authors/[author]; see that loader for the redirects. */
export const load: PageServerLoad = async ({ fetch, params, url, setHeaders }) => {
  const slug = categorySlug(params.category);
  if (!slug) error(404, 'Category not found');
  const pageNumber = Math.max(1, Math.floor(Number(url.searchParams.get('page') ?? 1)) || 1);
  if (slug !== params.category || url.searchParams.get('page') === '1') {
    const query = pageNumber > 1 ? `?page=${pageNumber}` : '';
    redirect(301, `/categories/${encodeURIComponent(slug)}${query}`);
  }

  const client = appDb(fetch);
  const category = (await fetchCategories(client)).find((entry) => entry.slug === slug);
  if (!category) error(404, 'Category not found');

  const { posts, total } = await fetchCategoryPosts(client, category.names, {
    limit: LISTING_PAGE_SIZE,
    offset: (pageNumber - 1) * LISTING_PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil(total / LISTING_PAGE_SIZE));
  if (pageNumber > totalPages) error(404, 'No such page');

  setHeaders({ 'cache-control': 'public, max-age=60, s-maxage=300' });
  return { category: { name: category.name, slug }, posts, total, pageNumber, totalPages };
};

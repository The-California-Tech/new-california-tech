import { error, redirect } from '@sveltejs/kit';
import { ARTICLES_ALIAS } from '#lib/symbiont.ts';
import { appDb } from '#lib/utils/app-db.ts';

/**
 * /random: a temporary redirect to a published article picked at random.
 *
 * Two queries -- a count, then the row at a random offset -- rather than
 * `order by random()`, which PostgREST cannot express without a new SQL
 * function. Read with the public client, so RLS limits the pick to what is
 * already public (publish_at set and in the past).
 *
 * The redirect must never be cached, by the CDN or the browser, or every
 * visit would land on the same article.
 */
export async function GET({ fetch, setHeaders }) {
  setHeaders({ 'cache-control': 'no-store' });
  const db = appDb(fetch);

  const { count, error: countError } = await db
    .from('pages')
    .select('slug', { count: 'exact', head: true })
    .eq('datasource_alias', ARTICLES_ALIAS);
  if (countError || !count) error(503, 'No articles to choose from');

  const offset = Math.floor(Math.random() * count);
  const { data, error: pickError } = await db
    .from('pages')
    .select('slug')
    .eq('datasource_alias', ARTICLES_ALIAS)
    .order('page_id')
    .range(offset, offset)
    .maybeSingle();
  if (pickError || !data?.slug) error(503, 'Could not pick an article');

  redirect(302, `/${data.slug}`);
}

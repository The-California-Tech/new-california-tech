/**
 * Route: /issues/YYYY-MM-DD.pdf
 *
 * Redirects to the issue's PDF in Supabase storage.
 *
 * This used to stream the PDF through the function so the address bar kept
 * tech.caltech.edu. In the first days after launch, crawlers (Amazonbot
 * above all) fetched the whole archive, and every byte went Supabase ->
 * function -> CDN: about 28 GB of Vercel Fast Origin Transfer in two days,
 * against Hobby's 10 GB a month. A CDN cache hit would not have helped
 * much either -- Fast Data Transfer counts cached bytes too. Supabase's own
 * CDN serves the file now; links and the sitemap keep this URL.
 *
 * The redirect itself is cached at the CDN for a week: an archive PDF's
 * storage path (issues/{date}.pdf) does not change once uploaded.
 */

import { symbiont } from '#lib/symbiont.ts';
import type { RequestHandler } from './$types';

const REDIRECT_CACHE_CONTROL = 'public, max-age=86400, s-maxage=604800';

export const GET: RequestHandler = async ({ params, fetch }) => {
  const date = params.date;

  const post = await symbiont.getPageBySlug(date, { fetch, alias: 'tech-archives' });
  if (!post) {
    return new Response(`No issue found for ${date}`, { status: 404 });
  }

  const resolverUrl: string | undefined = post.meta?.resolver_url;
  if (!resolverUrl) {
    return new Response(`No PDF available for ${date}`, { status: 404 });
  }

  return new Response(null, {
    status: 302,
    headers: { Location: resolverUrl, 'Cache-Control': REDIRECT_CACHE_CONTROL },
  });
};

/**
 * CDN cache policies for public responses.
 *
 * The paper changes weekly, but launch-day crawler traffic (Googlebot, AI
 * crawlers, scrapers) showed that every cache miss is a function invocation,
 * a Supabase query and Fast Origin Transfer. So the CDN holds pages for an
 * hour and may serve a stale copy for a day while it refreshes in the
 * background; browsers keep at most a minute, so a reader's reload is fresh.
 *
 * The cost: a Notion edit can take up to an hour to show. A new deployment
 * empties the CDN cache, and so does "Purge CDN Cache" in the Vercel project
 * settings -- the way to pull a retracted article at once.
 *
 * Set these only on success. An error path that renders "no posts" must not
 * be held for an hour after the database recovers.
 */

/** Articles, issue pages, author and category pages, and their indexes. */
export const PAGE_CACHE_CONTROL = 'public, max-age=60, s-maxage=3600, stale-while-revalidate=86400';

/** The homepage feed, where a newly published issue should appear quickly. */
export const FEED_CACHE_CONTROL = 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400';

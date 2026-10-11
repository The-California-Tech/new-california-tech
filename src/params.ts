import { defineParams } from '@sveltejs/kit/params';

/**
 * Route param matchers. A matcher returns the param to match, or undefined to
 * not match (SvelteKit 3; these were boolean `match` functions in src/params/).
 */
export const params = defineParams({
  /** [date=issuedate]: an issue date, YYYY-MM-DD. */
  issuedate: (param) => (/^\d{4}-\d{2}-\d{2}$/.test(param) ? param : undefined),

  /**
   * [slug=slug]: anything without a file extension, so /<slug> does not
   * swallow requests like /sitemap.xml or /feed.json.
   */
  slug: (param) => (/\.[a-z0-9]+$/i.test(param) ? undefined : param),
});

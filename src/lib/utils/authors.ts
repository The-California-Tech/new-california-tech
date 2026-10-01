/**
 * Author URLs. Shared by the bylines (which link here) and the /authors routes
 * (which resolve the slug back to a name).
 *
 * `Authors` is a Notion multi_select, so a name is whatever an editor typed:
 * "Mike O’Sullivan", "Breadth-First/Depth-First Search", a trailing space, the
 * same person entered twice with different capitalisation. Slugging makes
 * those near-duplicates collide on purpose -- one person, one page. The slug
 * cannot be reversed, so /authors/[author] slugs every known name
 * (list_authors) and keeps all that match, fetching their articles together.
 */
import { nameSlug } from '$lib/utils/slug';

export const authorSlug = nameSlug;

/** Site-relative path to an author's page, or null if the name slugs to nothing. */
export function authorPath(name: string): string | null {
  const slug = authorSlug(name);
  return slug ? `/authors/${encodeURIComponent(slug)}` : null;
}

/**
 * Category URLs. A category is a `Tags` value; see authors.ts for why the slug
 * is one-way and how a page resolves it (list_categories, then keep every tag
 * that slugs alike -- "Feature" and "feature" are one section).
 */
import { nameSlug } from '$lib/utils/slug';

export const categorySlug = nameSlug;

/** Site-relative path to a category's page, or null if the tag slugs to nothing. */
export function categoryPath(tag: string): string | null {
  const slug = categorySlug(tag);
  return slug ? `/categories/${encodeURIComponent(slug)}` : null;
}

/**
 * The one slug rule for names that become URLs: author names and categories.
 * Both are Notion multi_select values, typed by hand, so the rule has to
 * forgive what hands do.
 *
 * Letters and digits in any script survive -- a name written in Chinese or
 * Cyrillic keeps its characters (the browser percent-encodes them) rather than
 * collapsing to an empty slug. Latin diacritics are folded first, so "José"
 * and "Jose" land on the same page. Apostrophes vanish rather than becoming a
 * hyphen: "o-sullivan" reads worse than "osullivan". Everything else becomes a
 * single hyphen, so "Science & Tech" is "science-tech".
 *
 * One-way by design: values that slug alike are one page. See authors.ts and
 * categories.ts for how each resolves a slug back to its values.
 */
export function nameSlug(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/['’‘`]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

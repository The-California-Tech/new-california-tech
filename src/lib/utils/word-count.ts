/**
 * Words in a markdown body, for the `Word Count` column in Notion.
 *
 * Shared by the sync (sync/hooks/tech.ts, for Notion-owned articles) and by
 * /submit and /share (for web-edited ones, whose body the sync never reads), so
 * an article counts the same whichever side owns it. Pure.
 */
export function countWordsFromMarkdown(markdown: string): number {
  if (!markdown.trim()) {
    return 0;
  }

  const plainText = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[>#*_~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!plainText) {
    return 0;
  }

  return plainText.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

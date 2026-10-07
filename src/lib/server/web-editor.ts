/**
 * What a web-editor article looks like from the Notion side: the placeholder
 * body, and the edit-link line in `Info`. Shared by /submit (which creates such
 * pages) and the sync (which turns existing pages into them), so the two cannot
 * drift apart.
 */
import type { RichTextItemResponse } from '@notionhq/client';
import { appendOrReplaceTaggedLine, type RichTextRequestItem } from 'symbiont-cms/server';
import {
  INFO_PROPERTY,
  WHERE_IS_IT_NOTION_PAGE,
  WHERE_IS_IT_PROPERTY,
  WHERE_IS_IT_WEB_EDITOR,
} from '$lib/sync/properties';

/**
 * Marks the machine-written line in Info. Its presence also tells the sync
 * that a page /submit has just created is already set up -- at its first sync
 * the share_links row does not exist yet, so the line is the only sign.
 */
export const EDIT_LINK_TAG = '[web editor]';

/**
 * The Notion page body while the web editor owns the text. It links the same
 * edit link that is in Info: anyone who can see this page can see Info, so a
 * separate read-only link here would protect nothing.
 */
export function placeholderBody(editUrl: string): string {
  return [
    'This piece is being written on the Tech website. Its text lives there, not in this page.',
    '',
    `**[Open it in the web editor](${editUrl})** (the same link is in **${INFO_PROPERTY}**).`,
    '',
    `To edit it in Notion instead, change **${WHERE_IS_IT_PROPERTY}** from **${WHERE_IS_IT_WEB_EDITOR}** to ` +
      `**${WHERE_IS_IT_NOTION_PAGE}**. The latest text is copied into this page on the next sync, and the web ` +
      'editor link stops accepting edits until it is switched back.',
  ].join('\n');
}

function editLine(editUrl: string): string {
  return `${EDIT_LINK_TAG} Edit on the website: ${editUrl}`;
}

/** Make the URL part of the line clickable. */
function linkify(items: RichTextRequestItem[], editUrl: string): RichTextRequestItem[] {
  const last = items[items.length - 1];
  if (last && last.text.content.startsWith(EDIT_LINK_TAG)) last.text.link = { url: editUrl };
  return items;
}

/**
 * Info's new value: whatever the editors wrote, with the edit-link line
 * added or replaced at the end.
 */
export function infoWithEditLink(existing: RichTextItemResponse[], editUrl: string): RichTextRequestItem[] {
  return linkify(
    appendOrReplaceTaggedLine(existing, editLine(editUrl), { tag: EDIT_LINK_TAG, color: 'blue' }),
    editUrl,
  );
}

/** Does this page's Info already carry an edit link? */
export function hasEditLink(info: RichTextItemResponse[] | undefined): boolean {
  return (info ?? []).some((item) => item.plain_text.includes(EDIT_LINK_TAG));
}

import { createSymbiontServer } from 'symbiont-cms/server';
import { symbiont } from '$lib/symbiont.js';
import {
  excludeAndDeletePrintOnlyHook,
  publishCheckHook,
  publishDateHook,
  articlePreviewMetadataHook,
  publicTagsHook,
  htmlCodeEmbedHook,
  wordCountSyncHook,
  archiveIssueHooks,
  websitePagesHooks,
} from '$lib/sync/hooks/tech.js';
import { syncNoteHooks } from '$lib/sync/hooks/sync-note.js';
import { layoutExpansionHooks } from '$lib/sync/hooks/layout-expansion.js';
import { contentSourceHooks, contentSourceMetadata } from '$lib/sync/hooks/content-source.js';

export const symbiontSync = createSymbiontServer(symbiont, {
  'tech-article-staging': {
    slugProperty: 'Website Slug',
    // No tagsProperty: publicTagsHook reads Tags itself, to drop internal ones.
    authorsProperty: 'Authors',
    coverProperty: 'Cover Photo',
    summaryProperty: 'Website Summary',
    // content MUST stay false while any article can be database-owned (Source
    // of Truth = Database): content:sync would write pages.content over the
    // Notion page. The content-source hooks skip the whole content pipeline for
    // those pages, which covers it, but this setting is the backstop.
    syncBackToNotion: {
      content: false,
      properties: true,
    },
    shouldSync: excludeAndDeletePrintOnlyHook.fn,
    isPublished: publishCheckHook.fn,
    publishDate: (ctx) => publishDateHook.fn(ctx),
    // One slot, two contributors. Not a second metadata:add hook: symbiont
    // rejects a slot and a hook on the same event, before syncing anything.
    addMetadata: async (ctx) => {
      const merged = { ...(await articlePreviewMetadataHook.fn(ctx)), ...contentSourceMetadata(ctx) };
      return Object.keys(merged).length > 0 ? merged : null;
    },
    transformContent: (ctx) => htmlCodeEmbedHook.fn(ctx),
    hooks: [publicTagsHook, ...contentSourceHooks, wordCountSyncHook, ...layoutExpansionHooks, ...syncNoteHooks],
  },
  'tech-archives': {
    hooks: [...archiveIssueHooks, ...syncNoteHooks],
  },
  'tech-website-pages': {
    slugProperty: 'Slug',
    hooks: [...websitePagesHooks, ...syncNoteHooks],
  },
});

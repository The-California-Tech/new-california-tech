import { createSymbiontServer } from 'symbiont-cms/server';
import { symbiont } from '$lib/symbiont.js';
import {
	excludeAndDeletePrintOnlyHook,
	publishCheckHook,
	publishDateHook,
	articlePreviewMetadataHook,
	htmlCodeEmbedHook,
	wordCountSyncHook,
	archiveIssueHooks,
	websitePagesHooks
} from '$lib/hooks/tech-hooks.js';

export const symbiontSync = createSymbiontServer(symbiont, {
	'tech-article-staging': {
		slugProperty: 'Website Slug',
		tagsProperty: 'Tags',
		authorsProperty: 'Authors',
		coverProperty: 'Cover Photo',
		summaryProperty: 'Website Summary',
		syncBackToNotion: {
			content: false,
			properties: true
		},
		shouldSync: excludeAndDeletePrintOnlyHook.fn,
		isPublished: publishCheckHook.fn,
		publishDate: (ctx) => publishDateHook.fn(ctx),
		addMetadata: (ctx) => articlePreviewMetadataHook.fn(ctx),
		transformContent: (ctx) => htmlCodeEmbedHook.fn(ctx),
		hooks: [wordCountSyncHook]
	},
	'tech-archives': {
		hooks: archiveIssueHooks
	},
	'tech-website-pages': {
		slugProperty: 'Slug',
		hooks: websitePagesHooks
	}
});

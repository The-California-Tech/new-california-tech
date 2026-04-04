import { createSyncClient } from 'symbiont-cms/server';
import { symbiont } from '$lib/symbiont.js';
import { techHooks, archiveIssueHooks, websitePagesHooks } from '$lib/hooks/tech-hooks.js';

export const symbiontSync = createSyncClient(symbiont, {
	'tech-article-staging': techHooks,
	'tech-archives': archiveIssueHooks,
	'tech-website-pages': websitePagesHooks
});

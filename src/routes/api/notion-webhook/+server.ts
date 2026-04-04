import { handleNotionWebhookRequest } from 'symbiont-cms/server';
import { symbiontSync } from '$lib/symbiont.server.js';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * Notion webhook endpoint for page automation events.
 * Authenticates requests via NOTION_WEBHOOK_SECRET.
 */
export async function POST(event: RequestEvent) {
	return handleNotionWebhookRequest(symbiontSync, event);
}

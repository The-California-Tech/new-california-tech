import { handleNotionWebhookRequest } from 'symbiont-cms/server';
import { symbiontSync } from '$lib/symbiont.server.js';
import { runAsManualSync } from '$lib/sync/manual-trigger';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * Notion webhook endpoint for page automation events.
 * Authenticates requests via NOTION_WEBHOOK_SECRET.
 *
 * The `Sync to website` button posts here too, with `?trigger=button` on its
 * URL, so its sync always reports back in Sync Status (see manual-trigger.ts).
 * The flag only ever loosens that note; the secret still authenticates.
 */
export async function POST(event: RequestEvent) {
  const sync = () => handleNotionWebhookRequest(symbiontSync, event);
  return event.url.searchParams.get('trigger') === 'button' ? runAsManualSync(sync) : sync();
}

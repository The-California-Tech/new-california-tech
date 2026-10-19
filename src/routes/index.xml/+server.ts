import { redirect } from '@sveltejs/kit';

/**
 * /index.xml: the old Hugo site's RSS feed. Readers subscribed to it follow a
 * permanent redirect and update the address, so they move to the Atom feed
 * instead of silently going quiet. The category feeds (/categories/x/index.xml)
 * are not carried over.
 */
export function GET() {
  redirect(301, '/atom.xml');
}

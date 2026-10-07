/**
 * The service-role Supabase client, typed with this app's schema.
 *
 * Server-only (it is under $lib/server, which SvelteKit refuses to bundle for
 * the browser): it bypasses RLS. For the writes the public client cannot make
 * -- share links, a web-edited article's body -- and nothing else.
 */
import { requireEnvVar } from 'symbiont-cms/server';
import { symbiont } from '$lib/symbiont';
import type { AppDb } from '$lib/utils/app-db';

export function adminDb(): AppDb {
  return symbiont.getSSRClient(undefined, requireEnvVar('SUPABASE_SERVICE_ROLE_KEY')) as unknown as AppDb;
}

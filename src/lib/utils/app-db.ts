/**
 * The Supabase client, typed with THIS app's schema.
 *
 * symbiont.getSSRClient() is typed with the Database that symbiont-cms ships,
 * which knows symbiont's tables but not the Tech's functions
 * (list_homepage_posts, list_authors, ...). It is the same connection either
 * way; this only swaps in the types generated from supabase/ here, so an RPC
 * with a misspelt function or argument name fails `pnpm check` instead of
 * failing at request time.
 *
 * Regenerate with `pnpm db:types` (local Supabase, from the migrations) or
 * `pnpm db:types:linked` (production). CI fails if the committed file is stale.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { symbiont } from '$lib/symbiont';
import type { Database } from '$lib/types/database.types';

export type AppDb = SupabaseClient<Database>;

export function appDb(fetch?: typeof globalThis.fetch): AppDb {
  return symbiont.getSSRClient(fetch) as unknown as AppDb;
}

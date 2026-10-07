/**
 * Build every datasource's sync configuration exactly as a sync would, and
 * fail if symbiont rejects any of them.
 *
 *   pnpm check:sync-config
 *
 * WHY THIS EXISTS
 *   symbiont validates a sync config when a sync starts (resolveSyncDatabase),
 *   not at build time -- e.g. it refuses a named slot and a custom hook on the
 *   same event. Such a config type-checks, builds and deploys cleanly, and then
 *   every sync for that datasource throws before touching a page. That shipped
 *   once: a metadata:add hook next to the addMetadata slot took down every
 *   article sync in production. This runs the same call, through Vite's SSR
 *   loader so $lib / $config / asset imports resolve as they do in the app, and
 *   needs no secrets: it only builds the hook registry.
 */
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
let failed = false;
try {
  const { symbiontSync } = await server.ssrLoadModule('/src/lib/symbiont.server.ts');
  const { resolveSyncDatabase } = await server.ssrLoadModule('symbiont-cms/server');
  for (const db of symbiontSync.config.databases) {
    try {
      const { hooks } = resolveSyncDatabase(symbiontSync, db);
      console.log(`ok    ${db.alias} (${hooks.length} hooks)`);
    } catch (error) {
      failed = true;
      console.error(`FAIL  ${db.alias}: ${error instanceof Error ? error.message : error}`);
    }
  }
} finally {
  await server.close();
}
process.exit(failed ? 1 : 0);

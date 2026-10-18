/**
 * Folders in the `media` bucket that symbiont's cleanupUnusedMedia must never
 * delete, whatever it thinks is referenced. Passed once to createSymbiontServer
 * (symbiont.server.ts), which applies it to every cleanup symbiont runs, and by
 * hand to any script that calls cleanupUnusedMedia itself.
 *
 * - `submissions/`: /submit's images. The browser uploads each one as soon as
 *   it is added, so a draft that is still being written has images no page
 *   references yet. A sweep would delete them out from under the writer.
 * - `legacy/`: images imported from the old Hugo site. Referenced by their
 *   articles, so the sweep would keep them anyway; protected so that removing
 *   an imported article can never take the only copy with it.
 */
import { SUBMISSION_MEDIA_PREFIX } from './submission.ts';

export const LEGACY_MEDIA_PREFIX = 'legacy/';

export const PROTECTED_MEDIA_PREFIXES = [SUBMISSION_MEDIA_PREFIX, LEGACY_MEDIA_PREFIX];

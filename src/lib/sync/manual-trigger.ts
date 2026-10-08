/**
 * Whether the sync running now was asked for by a person: the `Sync to website`
 * button in Notion, whose webhook URL carries `?trigger=button`.
 *
 * It matters only to the Sync Status note. That note is normally withheld when
 * the page's last edit was the integration's own (writeBackSafe), because the
 * webhook that edit fires would otherwise write again, forever. But clicking a
 * button does not edit the page, so after any earlier sync note the last edit
 * is still ours, and the person who clicked would get no answer at all. A click
 * cannot be the echo of our own write, so it is always safe to answer; the edit
 * that answer makes fires an ordinary webhook, which stays silent as usual.
 *
 * Request-scoped through AsyncLocalStorage rather than a parameter, because the
 * flag has to cross symbiont's sync pipeline, which has no slot for it.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

const manual = new AsyncLocalStorage<true>();

export function runAsManualSync<T>(fn: () => Promise<T>): Promise<T> {
  return manual.run(true, fn);
}

export function isManualSync(): boolean {
  return manual.getStore() === true;
}

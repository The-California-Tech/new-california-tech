/**
 * What one sync does about who owns an article's body. Pure, so the table
 * below can be tested without Notion or a database; the hooks that act on it
 * are in hooks/content-source.ts, which explains the design.
 */
export interface ContentSourceState {
  /** Where is it says Web Editor now. */
  nowWeb: boolean;
  /** A pages row exists for this page. */
  rowExists: boolean;
  /** The row's meta.contentSource was `web` as of the last sync. */
  wasWeb: boolean;
  /** Info already carries an edit-link line. */
  linked: boolean;
}

export interface ContentSourceDecision {
  /** Skip the content pipeline: the web editor's text must not be read over. */
  skipContent: boolean;
  /** Record meta.contentSource = web. */
  markWeb: boolean;
  /**
   * After the save: give the page its web-editor setup (placeholder body, and
   * the edit link -- reused from Info if it has a working one, else new).
   */
  setup: boolean;
  /** Before the content pipeline: write the stored body into Notion. */
  handoff: boolean;
}

export function decideContentSource({ nowWeb, rowExists, wasWeb, linked }: ContentSourceState): ContentSourceDecision {
  if (nowWeb) {
    // Steady, or a page /submit has just created (no row yet, but already set
    // up -- the Info line says so). The body is the web editor's.
    if (wasWeb || (!rowExists && linked)) {
      return { skipContent: true, markWeb: true, setup: !linked, handoff: false };
    }
    // Take-in: read Notion's body this once, then set the page up.
    return { skipContent: false, markWeb: true, setup: true, handoff: false };
  }
  // Notion owns it. A handoff only if the web editor owned it last time.
  return { skipContent: false, markWeb: false, setup: false, handoff: wasWeb };
}

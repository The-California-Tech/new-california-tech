/**
 * Embed providers for symbiont's renderer (`markdown.embeds` in symbiont.ts).
 *
 * A link that is alone in its paragraph is offered to each provider; one that
 * recognises it returns the embed HTML. That covers every way a puzzle reaches
 * an article: a Notion embed block (it syncs as exactly such a link), a link
 * pasted on its own line in the web editor, and the old Hugo site's
 * `{{% crossword "..." %}}` shortcode, which the import rewrites to the link.
 *
 * The returned HTML is inserted as-is, so each provider validates strictly and
 * builds its markup from the validated parts, never from the raw URL.
 */
import type { EmbedProvider } from 'symbiont-cms';

/** Crosshare puzzle and user IDs: Firestore-style, letters and digits. */
const CROSSHARE_ID = '[A-Za-z0-9]{8,40}';
const CROSSHARE_EMBED_PATH = new RegExp(`^/embed/(${CROSSHARE_ID})/(${CROSSHARE_ID})/?$`);

/**
 * https://crosshare.org/embed/<puzzleId>/<userId>, the URL Crosshare's own
 * "embed" option produces (the user ID selects that constructor's embed
 * styling). The old site embedded exactly these.
 */
export const crosshareEmbed: EmbedProvider = {
  name: 'crosshare',
  render(url) {
    if (url.protocol !== 'https:' || url.hostname !== 'crosshare.org') return null;
    const match = CROSSHARE_EMBED_PATH.exec(url.pathname);
    if (!match) return null;
    const [, puzzleId, userId] = match;
    return (
      `<div class="embed embed-crosshare">` +
      `<iframe src="https://crosshare.org/embed/${puzzleId}/${userId}" title="Crossword (Crosshare)" ` +
      `loading="lazy" allow="fullscreen"></iframe>` +
      `</div>`
    );
  },
};

export const embedProviders: EmbedProvider[] = [crosshareEmbed];

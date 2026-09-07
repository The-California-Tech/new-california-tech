/**
 * Generate the social-share card (og:image / twitter:image).
 *
 *   pnpm run make:og-card
 *
 * WHY THIS EXISTS RATHER THAN POINTING og:image AT THE SOURCE IMAGE
 *   tech-eclipse.webp is 3151x460 -- a 6.85:1 banner. Social platforms render
 *   share cards at roughly 1.91:1 (1200x630) and CENTER-CROP anything wider, so
 *   used directly it would appear as a narrow horizontal sliver with the ends
 *   cut off. Padding it into a correctly-proportioned canvas keeps the whole
 *   image visible.
 *
 *   Output is deterministic and committed, so the build does not depend on
 *   sharp and CI does not need to regenerate it. Re-run this only when the
 *   source art or the background changes.
 *
 * Replaces qwer.webp, which was the upstream theme's logo -- every Tech link
 * shared to Slack, iMessage, Discord or Twitter previewed with another
 * project's branding.
 */
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, '../user/public/tech-eclipse.webp');
const OUT = resolve(here, '../user/assets/og-card.png');

/** Social card dimensions. 1.91:1 is what Twitter/Slack/Discord/Facebook use. */
const WIDTH = 1200;
const HEIGHT = 630;

/**
 * Background behind the banner. Black reads as deliberate for a masthead image
 * and avoids the grey-letterbox look a mid-tone would give. Change here if the
 * Tech settles on a brand colour.
 */
const BACKGROUND = { r: 0, g: 0, b: 0, alpha: 1 };

/** Leave a margin so the art is not flush to the edges when cropped slightly. */
const INSET = 80;

async function main() {
  const meta = await sharp(SRC).metadata();
  console.log(`source: ${meta.width}x${meta.height} (${meta.format})`);

  const banner = await sharp(SRC)
    .resize({
      width: WIDTH - INSET * 2,
      height: HEIGHT - INSET * 2,
      fit: 'inside', // preserve aspect ratio; never crop the source
      withoutEnlargement: false,
    })
    .toBuffer();

  await sharp({
    create: { width: WIDTH, height: HEIGHT, channels: 4, background: BACKGROUND },
  })
    .composite([{ input: banner, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(OUT);

  const out = await sharp(OUT).metadata();
  console.log(`wrote ${OUT}`);
  console.log(`output: ${out.width}x${out.height} (${out.format})`);
  console.log('\nNow verify the card renders as intended before launch:');
  console.log('  https://cards-dev.twitter.com/validator');
  console.log('  https://www.opengraph.xyz/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

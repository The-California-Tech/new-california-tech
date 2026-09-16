/**
 * Import a Google Doc into Notion, keeping the images at full resolution.
 *
 *   pnpm run gdoc:login                              # once per Google account
 *   pnpm run import:gdoc -- <doc-url>                # -> tech-article-staging
 *   pnpm run import:gdoc -- <doc-url> --db tech-website-pages
 *   pnpm run import:gdoc -- <doc-url> --into TECH-675              # append
 *   pnpm run import:gdoc -- <doc-url> --into TECH-675 --overwrite  # replace
 *   pnpm run import:gdoc -- <doc-url> --md ./out.md  # no Notion; drag it in yourself
 *
 * WHY THIS EXISTS
 *   Exporting a Doc as Markdown and importing that into Notion works fine for
 *   the text, but Google embeds DOWNSCALED copies of the images as base64 in
 *   the reference definitions at the bottom of the file. That is where the
 *   quality goes. See googleDocs.ts for the fix (two exports, reconciled).
 *
 * WHY NOTION'S `markdown` PARAM RATHER THAN BUILDING BLOCKS
 *   POST /v1/pages accepts a `markdown` body param and runs Notion's own
 *   parser, which handles toggles, callouts, columns, equations, H4 and tables
 *   that a hand-rolled markdown-to-blocks pass would drop on the floor. Images
 *   go in as placeholder URLs and get swapped for uploaded files afterwards,
 *   because markdown has no way to reference a Notion file upload.
 *
 * Needs NOTION_TOKEN plus GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET in .env.
 * The Notion integration must be connected to the destination database or page.
 */
import { Client, isFullBlock } from '@notionhq/client';
import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';

// Relative, not '$lib/symbiont': `$lib` is a Vite alias and this script runs
// under tsx, which does not know about SvelteKit's aliases.
import { symbiont } from '../src/lib/symbiont.js';
import {
  exportDoc,
  forgetAccount,
  listAccounts,
  parseDocId,
  resolveAccount,
  signIn,
  type DocImage,
} from './googleDocs.js';

const DEFAULT_DB_ALIAS = 'tech-article-staging';

/** Placeholder host for images awaiting upload. Never resolved over the network. */
const PLACEHOLDER = 'https://gdoc-import.invalid';

/** Notion's markdown parser is synchronous below this; above it, go async. */
const ASYNC_THRESHOLD = 400_000;

const kb = (n: number) => `${(n / 1024).toFixed(0)} KB`;

/* -------------------------------------------------------------------------- */
/* Markdown image rewriting                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Rewrite every image in the markdown using `resolve`.
 *
 * Handles inline `![a](b)` and reference-style `![a][b]`, and deletes the
 * orphaned `[b]: ...` definitions afterwards -- those hold Google's downscaled
 * base64, so leaving them would both bloat the payload and re-introduce the
 * exact images we are trying to replace.
 *
 * Images are numbered by the order they appear here, which is document order.
 * The reference label is used only to find its definition line for removal --
 * never to identify which file the image is; see the note on withPlaceholders.
 */
function rewriteImages(markdown: string, resolve: (index: number) => string): { markdown: string; count: number } {
  let count = 0;
  const usedRefs = new Set<string>();

  const IMAGE = /!\[([^\]]*)\](?:\(\s*<?([^)>\s]*)>?(?:\s+"[^"]*")?\s*\)|\[([^\]]*)\])/g;

  const rewritten = markdown.replace(IMAGE, (_all, alt: string, _url?: string, ref?: string) => {
    const position = count++;
    if (ref !== undefined) usedRefs.add(ref.trim().toLowerCase());
    return `![${alt ?? ''}](${resolve(position)})`;
  });

  const cleaned = rewritten
    .split('\n')
    .filter((line) => {
      const match = line.match(/^\s*\[([^\]]+)\]:\s*\S/);
      return !(match && usedRefs.has(match[1].trim().toLowerCase()));
    })
    .join('\n');

  return { markdown: cleaned, count };
}

/**
 * Both sides are in document order -- the Markdown export by definition, and
 * the zip images because imagesFromZip reads their order off the exported
 * HTML -- so the nth image reference means the nth image file.
 *
 * Do NOT get clever with Google's `imageN` names. N is the order the image was
 * added to the doc, and the two exports number independently, so neither
 * sorting the names nor matching them across exports yields document order.
 * That is exactly what put the parrots out of sequence.
 */
const asPlaceholder = (images: DocImage[]) => (i: number) =>
  `${PLACEHOLDER}/${i}/${encodeURIComponent(images[i]?.name ?? `image${i + 1}.png`)}`;

const asDataUri = (images: DocImage[]) => (i: number) => {
  const image = images[i];
  return image ? `data:${image.mime};base64,${image.data.toString('base64')}` : `${PLACEHOLDER}/${i}/missing.png`;
};

/**
 * Put every image on a line of its own.
 *
 * Notion has no inline images: an image sharing a line with text becomes a
 * paragraph, and the image is quietly dropped rather than turned into an image
 * block. Google's export produces exactly that shape whenever a caption follows
 * a photo (`![](img)*Caption here.*`), so without this the captioned images
 * vanish and the upload step finds no placeholder to replace.
 *
 * Table rows are left alone — splitting those would destroy the table, and
 * Google does not put images in Markdown tables anyway.
 */
function isolateImages(markdown: string): { markdown: string; isolated: number } {
  const INLINE = /!\[[^\]]*\]\([^)\s]*\)/g;
  let isolated = 0;

  const lines = markdown.split('\n').map((line) => {
    if (/^\s*\|/.test(line)) return line;

    const pieces: string[] = [];
    let cursor = 0;
    let sharedWithText = false;
    INLINE.lastIndex = 0;

    for (let match = INLINE.exec(line); match !== null; match = INLINE.exec(line)) {
      const before = line.slice(cursor, match.index).trim();
      if (before) {
        pieces.push(before);
        sharedWithText = true;
      }
      pieces.push(match[0]);
      cursor = match.index + match[0].length;
    }
    if (pieces.length === 0) return line;

    const after = line.slice(cursor).trim();
    if (after) {
      pieces.push(after);
      sharedWithText = true;
    }

    if (sharedWithText) isolated += pieces.filter((piece) => piece.startsWith('![')).length;
    return pieces.join('\n\n');
  });

  return { markdown: lines.join('\n'), isolated };
}

/**
 * Some images never appear in the Markdown export even though they are in the
 * doc -- anything inside a table cell, a drawing, or a header, which Google's
 * Markdown converter drops on the floor. They are still in the zip, so rather
 * than lose them, tack the unreferenced ones onto the end of the page.
 *
 * Positional pairing means references 0..count-1 already took images
 * 0..count-1, so whatever is left over starts at `count`.
 */
function prepareMarkdown(
  body: string,
  images: DocImage[],
  render: (images: DocImage[]) => (i: number) => string,
): { markdown: string; count: number; appended: number; isolated: number } {
  const url = render(images);
  const rewritten = rewriteImages(body, url);
  const { markdown, isolated } = isolateImages(rewritten.markdown);
  const count = rewritten.count;

  const leftover = images.slice(count);
  if (leftover.length === 0) return { markdown, count, appended: 0, isolated };

  const extras = leftover.map((_, k) => `![](${url(count + k)})`).join('\n\n');
  return {
    markdown: `${markdown.trimEnd()}\n\n${extras}\n`,
    count: images.length,
    appended: leftover.length,
    isolated,
  };
}

const withPlaceholders = (markdown: string, images: DocImage[]) => prepareMarkdown(markdown, images, asPlaceholder);

const withDataUris = (markdown: string, images: DocImage[]) => prepareMarkdown(markdown, images, asDataUri);

/** Which image does this placeholder URL stand for? */
function placeholderIndex(url: string | undefined): number | null {
  if (!url?.startsWith(`${PLACEHOLDER}/`)) return null;
  const index = Number.parseInt(url.slice(PLACEHOLDER.length + 1), 10);
  return Number.isInteger(index) ? index : null;
}

/**
 * Google's Markdown export opens with the document title as an H1. We set the
 * Notion title from the Drive filename, so that H1 would show up twice.
 */
function stripLeadingTitle(markdown: string, title: string): string {
  const lines = markdown.split('\n');
  const first = lines.findIndex((line) => line.trim() !== '');
  if (first < 0) return markdown;
  const heading = lines[first].match(/^#\s+(.*)$/);
  if (!heading) return markdown;
  if (heading[1].trim().toLowerCase() !== title.trim().toLowerCase()) return markdown;
  return lines.slice(first + 1).join('\n');
}

/* -------------------------------------------------------------------------- */
/* Notion                                                                      */
/* -------------------------------------------------------------------------- */

function notionClient(): Client {
  const auth = process.env.NOTION_TOKEN;
  if (!auth) throw new Error('NOTION_TOKEN is not set (expected in .env).');
  return new Client({ auth });
}

/** Accepts a Notion page URL or a dashed/undashed UUID. Returns a dashed UUID. */
function parseNotionId(input: string): string {
  const hex = String(input ?? '').replace(/[^a-fA-F0-9]/g, '');
  if (hex.length < 32) throw new Error(`Could not find a Notion ID in: ${input}`);
  // A URL slug can contribute stray hex characters; the real ID is the tail.
  const id = hex.slice(-32).toLowerCase();
  return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
}

function dataSourceIdFor(alias: string): string {
  const match = symbiont.config.databases.find((db) => db.alias === alias);
  if (!match) {
    const known = symbiont.config.databases.map((db) => db.alias).join(', ');
    throw new Error(`Unknown database alias "${alias}". Known: ${known}`);
  }
  return match.dataSourceId;
}

type PropertySchema = { type?: string; unique_id?: { prefix?: string | null } };

const schemaCache = new Map<string, Record<string, PropertySchema>>();

async function propertiesOf(notion: Client, dataSourceId: string): Promise<Record<string, PropertySchema>> {
  const cached = schemaCache.get(dataSourceId);
  if (cached) return cached;
  const source = await notion.dataSources.retrieve({ data_source_id: dataSourceId });
  const properties = (source as { properties?: Record<string, PropertySchema> }).properties ?? {};
  schemaCache.set(dataSourceId, properties);
  return properties;
}

/** Data sources name their title property whatever they like; go and look. */
async function titlePropertyName(notion: Client, dataSourceId: string): Promise<string> {
  const properties = await propertiesOf(notion, dataSourceId);
  const found = Object.entries(properties).find(([, value]) => value?.type === 'title');
  if (!found) throw new Error(`Data source ${dataSourceId} has no title property.`);
  return found[0];
}

/** Notion's auto-numbered ID property, as displayed: TECH-675, ISSUE-12. */
const SHORT_ID = /^([A-Za-z][A-Za-z0-9_]*)-(\d+)$/;

/**
 * Resolve a short ID to a page.
 *
 * Notion's "unique ID" property renders as PREFIX-N but is stored as a bare
 * number, so we have to find the data source whose ID property carries that
 * prefix and then query it. Prefixes are discovered from the schema rather than
 * hardcoded, so adding a database to src/lib/symbiont.ts is enough.
 */
async function resolveShortId(notion: Client, reference: string): Promise<string> {
  const match = reference.match(SHORT_ID);
  if (!match) throw new Error(`Not a short ID: ${reference}`);
  const [, prefix, digits] = match;
  const wanted = prefix.toLowerCase();

  const prefixesSeen: string[] = [];

  for (const database of symbiont.config.databases) {
    const properties = await propertiesOf(notion, database.dataSourceId);
    const idProperties = Object.entries(properties).filter(([, value]) => value?.type === 'unique_id');

    for (const [name, value] of idProperties) {
      const found = value.unique_id?.prefix ?? '';
      if (found) prefixesSeen.push(`${found}- (${database.alias})`);
      if (found.toLowerCase() !== wanted) continue;

      const results = await notion.dataSources.query({
        data_source_id: database.dataSourceId,
        filter: { property: name, unique_id: { equals: Number(digits) } },
        page_size: 2,
      });

      if (results.results.length > 1) {
        throw new Error(`${reference} matches more than one page in ${database.alias}.`);
      }
      if (results.results.length === 1) return results.results[0].id;

      throw new Error(`No page numbered ${reference} in ${database.alias}.`);
    }
  }

  const known = prefixesSeen.length ? prefixesSeen.join(', ') : 'none found';
  throw new Error(`No configured database has an ID property with prefix "${prefix}-". Known prefixes: ${known}.`);
}

/** Accept a Notion URL, a UUID, or a short ID like TECH-675. */
async function resolvePageId(notion: Client, reference: string): Promise<string> {
  if (SHORT_ID.test(reference)) return resolveShortId(notion, reference);
  return parseNotionId(reference);
}

async function awaitAsyncTask(notion: Client, taskId: string): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt++) {
    const task = (await notion.asyncTasks.retrieve({ task_id: taskId })) as {
      status?: string;
      poll_after_seconds?: number;
      error?: { message?: string };
    };
    if (task.status === 'succeeded') return;
    if (task.status === 'failed') {
      throw new Error(`Notion import failed: ${task.error?.message ?? 'unknown error'}`);
    }
    await new Promise((r) => setTimeout(r, (task.poll_after_seconds ?? 2) * 1000));
  }
  throw new Error('Notion import is still running after two minutes; check the page in Notion.');
}

type CreatePageArgs = Parameters<Client['pages']['create']>[0];
type PageParent = NonNullable<CreatePageArgs['parent']>;
type PageProperties = NonNullable<CreatePageArgs['properties']>;

async function createPage(
  notion: Client,
  parent: PageParent,
  properties: PageProperties,
  markdown: string,
): Promise<string> {
  const useAsync = markdown.length > ASYNC_THRESHOLD;

  const response = (await notion.pages.create({
    parent,
    properties,
    markdown,
    ...(useAsync ? { allow_async: true } : {}),
  })) as {
    object?: string;
    id?: string;
    result?: { id?: string };
  };

  if (response.object === 'async_task' && response.id) {
    await awaitAsyncTask(notion, response.id);
    const pageId = response.result?.id;
    if (pageId) return pageId;
    throw new Error(
      'Notion accepted the import asynchronously but did not return a page ID. ' +
        'The page should exist — check the destination in Notion.',
    );
  }

  if (!response.id) throw new Error('Notion did not return a page ID.');
  return response.id;
}

/**
 * Append the doc to the end of an existing page's body.
 *
 * `insert_content` is the only command that appends; `replace_content` would
 * wipe the page. Notion marks it legacy in favour of search-and-replace edits,
 * but there is no non-legacy "append" and it is still supported.
 */
async function writeToPage(notion: Client, pageId: string, markdown: string, overwrite: boolean): Promise<void> {
  const async = markdown.length > ASYNC_THRESHOLD ? { allow_async: true } : {};

  const command = overwrite
    ? ({ type: 'replace_content', replace_content: { new_str: markdown } } as const)
    : ({ type: 'insert_content', insert_content: { content: markdown, position: { type: 'end' } } } as const);

  try {
    const response = (await notion.pages.updateMarkdown({ page_id: pageId, ...command, ...async })) as {
      object?: string;
      id?: string;
    };
    if (response.object === 'async_task' && response.id) await awaitAsyncTask(notion, response.id);
  } catch (error) {
    // replace_content refuses by default if it would delete child pages or
    // databases. That guard is worth keeping, so explain it rather than
    // quietly passing allow_deleting_content.
    const message = (error as Error).message ?? String(error);
    if (overwrite && /child (page|database)|allow_deleting_content/i.test(message)) {
      throw new Error(
        `--overwrite would delete child pages or databases on this page, so Notion refused:\n  ${message}\n` +
          '  Move or delete them by hand first, or drop --overwrite and append instead.',
        { cause: error },
      );
    }
    throw error;
  }
}

type ImageBlock = { id: string; url: string | undefined };

/** Every image block on the page, in document order. */
async function collectImageBlocks(notion: Client, blockId: string): Promise<ImageBlock[]> {
  const found: ImageBlock[] = [];

  let cursor: string | undefined;
  do {
    const page = await notion.blocks.children.list({ block_id: blockId, start_cursor: cursor });
    for (const block of page.results) {
      if (!isFullBlock(block)) continue;
      if (block.type === 'image') {
        const image = block.image as { external?: { url: string } };
        found.push({ id: block.id, url: image.external?.url });
      } else if (block.has_children) {
        found.push(...(await collectImageBlocks(notion, block.id)));
      }
    }
    cursor = page.next_cursor ?? undefined;
  } while (cursor);

  return found;
}

/**
 * Upload the real image to Notion and point an existing image block at it.
 * Single-part uploads are capped at 20 MB (5 MB on free workspaces); above that
 * Notion wants the file split into parts.
 */
const SINGLE_PART_LIMIT = Number(process.env.NOTION_SINGLE_PART_LIMIT ?? 20 * 1024 * 1024);
const PART_SIZE = 10 * 1024 * 1024;

async function uploadImage(notion: Client, image: DocImage): Promise<string> {
  const send = (id: string, body: Buffer, partNumber?: string) =>
    notion.fileUploads.send({
      file_upload_id: id,
      file: { filename: image.name, data: new Blob([new Uint8Array(body)], { type: image.mime }) },
      ...(partNumber ? { part_number: partNumber } : {}),
    });

  if (image.data.length <= SINGLE_PART_LIMIT) {
    const upload = await notion.fileUploads.create({
      filename: image.name,
      content_type: image.mime,
    });
    await send(upload.id, image.data);
    return upload.id;
  }

  const parts = Math.ceil(image.data.length / PART_SIZE);
  const upload = await notion.fileUploads.create({
    mode: 'multi_part',
    number_of_parts: parts,
    filename: image.name,
    content_type: image.mime,
  });
  for (let i = 0; i < parts; i++) {
    const slice = image.data.subarray(i * PART_SIZE, Math.min((i + 1) * PART_SIZE, image.data.length));
    await send(upload.id, slice, String(i + 1));
  }
  await notion.fileUploads.complete({ file_upload_id: upload.id });
  return upload.id;
}

/**
 * Replace every placeholder image on the page with the real upload.
 *
 * Matching is strictly by placeholder URL, which carries the image's index, so
 * a block is only ever touched if this run put it there. Deliberately no
 * matching by document position as a backup: on an append the page's existing
 * images are indistinguishable from ours by position alone, and silently
 * overwriting someone's artwork is far worse than leaving a broken placeholder
 * and saying so.
 *
 * `expected` is how many images the markdown referenced, so a shortfall is
 * reported rather than passing unnoticed.
 */
async function attachImages(notion: Client, pageId: string, images: DocImage[], expected: number): Promise<number> {
  const blocks = await collectImageBlocks(notion, pageId);
  const ours = blocks
    .map((block) => ({ block, index: placeholderIndex(block.url) }))
    .filter((entry): entry is { block: ImageBlock; index: number } => entry.index !== null);

  let uploaded = 0;

  for (const { block, index } of ours) {
    const image = images[index];
    if (!image) {
      console.warn(`  ! No image file for reference #${index + 1}; leaving the placeholder.`);
      continue;
    }
    const fileUploadId = await uploadImage(notion, image);
    await notion.blocks.update({
      block_id: block.id,
      image: { file_upload: { id: fileUploadId } },
    });
    uploaded++;
    console.log(`  ↑ ${image.name} (${kb(image.data.length)})`);
  }

  if (uploaded < expected) {
    console.warn(
      `  ! ${expected - uploaded} of ${expected} image(s) could not be placed — Notion did not keep ` +
        'their placeholder URLs. Those blocks still point at gdoc-import.invalid; fix them by hand, ' +
        'or re-run with --md and import the file instead.',
    );
  }

  return uploaded;
}

/* -------------------------------------------------------------------------- */
/* CLI                                                                         */
/* -------------------------------------------------------------------------- */

const USAGE = `
Import a Google Doc into Notion, images and all.

  pnpm run gdoc:login                      sign in (repeat for each account)
  pnpm run gdoc:accounts                   list signed-in accounts
  pnpm run gdoc:logout -- <email>          forget an account

  pnpm run import:gdoc -- <doc-url> [options]

Options
  --db <alias>       destination data source (default: ${DEFAULT_DB_ALIAS})
                     known: ${symbiont.config.databases.map((d) => d.alias).join(', ')}
  --into <page>      append the doc to the end of an existing page's body
                     instead of creating a new one. Accepts a URL, a UUID,
                     or a short ID like TECH-675
  --overwrite        with --into, replace the page's content instead of
                     appending. Destructive; Notion still refuses if it would
                     delete child pages
  --title "..."      page title (default: the Doc's name)
  --account <email>  try this Google account first
  --md <file>        skip Notion; write markdown with full-res base64 images
  --inline           put images in the page as base64 instead of uploading them
                     (experimental — Notion may reject large data URIs)
  --dump <dir>       also write the intermediate markdown and image files
`;

/** Flags that stand alone. Everything else needs a value. */
const BOOLEAN_FLAGS = new Set(['inline', 'overwrite', 'help', 'h']);

/** `--dump` on its own is obviously meant to dump somewhere, so pick a spot. */
const DEFAULT_DUMP_DIR = './gdoc-dump';

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    // `pnpm run x -- --flag` forwards the separator itself, so we see a bare
    // `--` in argv. Without this it parses as a flag with an empty name and
    // swallows the next argument, which is how the doc URL used to vanish.
    if (arg === '--') continue;
    if (arg.startsWith('--')) {
      const [key, inline] = arg.slice(2).split('=');
      if (inline !== undefined) {
        flags[key] = inline;
        continue;
      }
      if (BOOLEAN_FLAGS.has(key)) {
        flags[key] = true;
        continue;
      }
      // Never silently take the next flag as this one's value, and never
      // silently turn a value flag into `true` — that is how `--dump
      // --overwrite` quietly skipped the dump and left nothing to debug with.
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[key] = argv[++i];
      } else if (key === 'dump') {
        flags[key] = DEFAULT_DUMP_DIR;
      } else {
        throw new Error(`--${key} needs a value, e.g. --${key} <value>`);
      }
    } else positional.push(arg);
  }
  return { positional, flags };
}

/**
 * `google.md` is Google's export exactly as received. Keep it: the rewritten
 * copy has already thrown away the reference labels, which is precisely the
 * information you need when the images come out in the wrong order.
 */
function reportImages(count: number, appended: number, isolated: number, files: number): void {
  const inText = count - appended;
  const parts = [`${inText} referenced in the text`];
  if (appended) parts.push(`${appended} appended at the end`);
  console.log(`• ${files} image file(s) in the export; ${parts.join(', ')}`);

  if (appended) {
    console.log("  (Google's Markdown export omits images in tables, drawings and headers)");
  }
  if (isolated) {
    console.log(`  (${isolated} image(s) shared a line with text and were split onto their own)`);
  }
  if (inText > files) {
    console.warn(
      `  ! ${inText - files} image reference(s) in the text have no matching file in the export. ` +
        'Those will stay broken; run with --dump and check google.html against images/.',
    );
  }
}

function dumpIntermediates(dir: string, raw: string, html: string | null, markdown: string, images: DocImage[]): void {
  const out = path.resolve(dir);
  fs.mkdirSync(path.join(out, 'images'), { recursive: true });
  fs.writeFileSync(path.join(out, 'google.md'), raw);
  if (html) fs.writeFileSync(path.join(out, 'google.html'), html);
  fs.writeFileSync(path.join(out, 'document.md'), markdown);
  images.forEach((image, i) =>
    fs.writeFileSync(path.join(out, 'images', `${String(i + 1).padStart(3, '0')}-${image.name}`), image.data),
  );
  console.log(`• Wrote intermediates to ${out}`);
}

async function main(): Promise<void> {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const [first, ...rest] = positional;

  if (!first || flags.help) {
    console.log(USAGE);
    return;
  }

  if (first === 'login') {
    console.log(`✓ Signed in as ${await signIn()}`);
    return;
  }
  if (first === 'accounts') {
    const accounts = listAccounts();
    console.log(accounts.length ? accounts.map((e) => `  ${e}`).join('\n') : '  (none — run: pnpm run gdoc:login)');
    return;
  }
  if (first === 'logout') {
    if (!rest[0]) throw new Error('Which account? pnpm run gdoc:logout -- <email>');
    console.log(forgetAccount(rest[0]) ? `✓ Forgot ${rest[0]}` : `  ${rest[0]} was not signed in.`);
    return;
  }

  // Check this before spending a couple of exports on it.
  if (flags.overwrite && typeof flags.into !== 'string') {
    throw new Error('--overwrite only means something with --into <page>; there is nothing to overwrite otherwise.');
  }

  const fileId = parseDocId(first);
  const { email, auth, file } = await resolveAccount(fileId, flags.account as string | undefined);
  console.log(`• Reading "${file.name}" as ${email}`);

  const { markdown: raw, images, html, orderedByHtml } = await exportDoc(auth, file);
  if (!orderedByHtml && images.length > 1) {
    console.warn(
      '  ! The export had no usable HTML, so image order fell back to filename order, ' +
        'which Google does not keep in document order. Check the images on the page.',
    );
  }
  const title = typeof flags.title === 'string' ? flags.title : file.name;
  const body = stripLeadingTitle(raw, file.name);

  // --- markdown file, for dragging into Notion by hand ---------------------
  if (typeof flags.md === 'string') {
    const { markdown, count, appended, isolated } = withDataUris(body, images);
    reportImages(count, appended, isolated, images.length);
    const dest = path.resolve(flags.md);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, `# ${title}\n\n${markdown}`);
    if (typeof flags.dump === 'string') dumpIntermediates(flags.dump, raw, html, markdown, images);

    const size = fs.statSync(dest).size;
    console.log(`\n✓ ${dest} (${kb(size)})`);
    if (size > 5 * 1024 * 1024) {
      console.warn("  ! Over 5 MB — Notion's importer may refuse it. Import via the API instead.");
    }
    console.log('  Notion → Import → Markdown.');
    return;
  }

  // --- straight into Notion ------------------------------------------------
  const inline = flags.inline === true || flags.inline === 'true';
  const { markdown, count, appended, isolated } = inline ? withDataUris(body, images) : withPlaceholders(body, images);
  reportImages(count, appended, isolated, images.length);
  if (typeof flags.dump === 'string') dumpIntermediates(flags.dump, raw, html, markdown, images);

  const notion = notionClient();

  // --- write into an existing page -----------------------------------------
  const overwrite = flags.overwrite === true || flags.overwrite === 'true';
  if (typeof flags.into === 'string') {
    const pageId = await resolvePageId(notion, flags.into);
    const where = `${flags.into}${SHORT_ID.test(flags.into) ? ` (${pageId})` : ''}`;
    console.log(overwrite ? `• Replacing all content of ${where}` : `• Appending to ${where}`);

    await writeToPage(notion, pageId, markdown, overwrite);
    const uploaded = inline ? 0 : await attachImages(notion, pageId, images, count);

    console.log(`\n✓ ${overwrite ? 'Replaced with' : 'Appended'} "${file.name}"`);
    if (!inline) console.log(`  ${uploaded} image(s) uploaded at full resolution`);
    console.log(`  https://www.notion.so/${pageId.replace(/-/g, '')}`);
    return;
  }

  // --- create a new page in a data source ----------------------------------
  const alias = typeof flags.db === 'string' ? flags.db : DEFAULT_DB_ALIAS;
  const dataSourceId = dataSourceIdFor(alias);
  const parent: PageParent = { type: 'data_source_id', data_source_id: dataSourceId };
  const property = await titlePropertyName(notion, dataSourceId);
  const properties: PageProperties = {
    [property]: { title: [{ type: 'text', text: { content: title.slice(0, 2000) } }] },
  };
  console.log(`• Destination: ${alias}`);

  const pageId = await createPage(notion, parent, properties, markdown);
  const uploaded = inline ? 0 : await attachImages(notion, pageId, images, count);

  console.log(`\n✓ ${title}`);
  if (!inline) console.log(`  ${uploaded} image(s) uploaded at full resolution`);
  console.log(`  https://www.notion.so/${pageId.replace(/-/g, '')}`);
}

main().catch((error: Error) => {
  console.error(`\n✗ ${error.message}`);
  process.exit(1);
});

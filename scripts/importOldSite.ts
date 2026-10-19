/**
 * Import articles from the old Hugo site (tech.caltech.edu before October
 * 2026) as web-editor articles in tech-article-staging.
 *
 *   pnpm exec tsx scripts/importOldSite.ts images --plan <dir>             # convert only
 *   pnpm exec tsx scripts/importOldSite.ts images --plan <dir> --upload    # and upload
 *   pnpm exec tsx scripts/importOldSite.ts articles --plan <dir> --only a,b          # dry run
 *   pnpm exec tsx scripts/importOldSite.ts articles --plan <dir> --only a,b --write
 *   pnpm exec tsx scripts/importOldSite.ts articles --plan <dir> --all --write
 *   pnpm exec tsx scripts/importOldSite.ts verify --plan <dir> [--repair]
 *   pnpm exec tsx scripts/importOldSite.ts fill-tags --plan <dir> [--write]
 *
 * <dir> holds the inputs built from the old site's repo and the URL review:
 *   import-plan.json    one entry per article, body already in this site's
 *                       Markdown, images as legacy://<storage key> tokens
 *   import-images.json  old static/ path -> storage key under media/legacy/
 *   oldsite/static/     the old site's files
 *
 * WHY WEB-EDITOR ARTICLES, NOT NOTION BODIES
 *   The old text is Markdown already. Written straight to pages.content it
 *   renders exactly as converted; pushed through Notion it would be parsed
 *   into blocks and back, which is where the formatting bugs live. Editors
 *   can still move any of these to Notion: changing Where is it hands the
 *   text over (sync/hooks/content-source.ts).
 *
 * ORDER, PER ARTICLE
 *   Same as /submit (server/submission.ts): the Notion page with its edit
 *   link in Info and a placeholder body, a sync to build the row, the text
 *   into pages.content, the link into share_links. Only then the date
 *   (Issue or Website Publish Date), so an article is never public without
 *   its text -- the mistake this replaces published 28 empty pages.
 *
 *   A sync the Notion automation starts on Vercel can race ours and save the
 *   placeholder over the text. Each article is re-read after it is dated, and
 *   `verify --repair` re-checks the lot at the end.
 *
 * Images are converted like /submit's (rotate, metadata stripped, longest
 * edge 2400, WebP) and stored at media/legacy/..., which the media sweep
 * never deletes (utils/media.ts).
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { Client } from '@notionhq/client';
import sharp from 'sharp';
import {
  createPageFromMarkdown,
  replacePageMarkdown,
  requireEnvVar,
  syncPage,
  withNotionRetry,
} from 'symbiont-cms/server';
import { ARTICLES_ALIAS, SUPABASE_URL, symbiont } from '../src/lib/symbiont.ts';
import { symbiontSync } from '../src/lib/symbiont.server.ts';
import { editLinkForPage, newShareToken, shareUrl, storeShareLinks } from '../src/lib/server/share-links.ts';
import { infoWithEditLink, placeholderBody } from '../src/lib/server/web-editor.ts';
import { countWordsFromMarkdown } from '../src/lib/utils/word-count.ts';
import {
  EDITORIAL_NOTES_PROPERTY,
  INFO_PROPERTY,
  INTERNAL_TAGS,
  TAGS_PROPERTY,
  TITLE_PROPERTY,
  WHERE_IS_IT_PROPERTY,
  WHERE_IS_IT_WEB_EDITOR,
  WORD_COUNT_PROPERTY,
} from '../src/lib/sync/properties.ts';

// Not in sync/properties.ts yet: symbiont.server.ts and sync/hooks/tech.ts
// still spell these out.
const SLUG_PROPERTY = 'Website Slug';
const AUTHORS_PROPERTY = 'Authors';
const COVER_PHOTO_PROPERTY = 'Cover Photo';
const STATUS_PROPERTY = 'Status';
const ISSUE_PROPERTY = 'Issue';
const WEBSITE_PUBLISH_DATE_PROPERTY = 'Website Publish Date';

interface PlanEntry {
  key: string;
  mode: 'new' | 'fill';
  old_urls: string[];
  slug: string;
  title: string;
  authors: string[] | null;
  tags: string[] | null;
  issue: string | null;
  publish_date: string | null;
  cover: string | null;
  body: string;
  words: number;
  notes: string[];
}

const args = process.argv.slice(2);
const command = args[0];
const flag = (name: string) => args.includes(`--${name}`);
const value = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};

const planDir = value('plan');
if (!planDir) throw new Error('--plan <dir> is required');
const plan: PlanEntry[] = JSON.parse(fs.readFileSync(path.join(planDir, 'import-plan.json'), 'utf8'));
const imageKeys: Record<string, string> = JSON.parse(fs.readFileSync(path.join(planDir, 'import-images.json'), 'utf8'));
const outDir = path.join(planDir, 'legacy-out');
const logFile = path.join(planDir, 'import-log.jsonl');

const db = symbiont.getSSRClient(undefined, requireEnvVar('SUPABASE_SERVICE_ROLE_KEY')) as any;
const notion = new Client({ auth: requireEnvVar('NOTION_TOKEN') });
const PUBLIC_MEDIA = `${SUPABASE_URL}/storage/v1/object/public/media/`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function log(entry: Record<string, unknown>) {
  fs.appendFileSync(logFile, JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n');
}

/** legacy://<key> and existing://<name> -> public bucket URLs. */
function resolveMedia(text: string): string {
  // Both are keys in the media bucket: legacy/... for this import's uploads,
  // a bare name for the placeholder covers already there.
  return text.replace(/(?:legacy|existing):\/\/([^)\s]+)/g, (_all, key: string) => PUBLIC_MEDIA + key);
}

function mediaRefs(entry: PlanEntry, kinds = 'legacy|existing'): string[] {
  const text = `${entry.body}\n${entry.cover ?? ''}`;
  return [...new Set([...text.matchAll(new RegExp(`(?:${kinds}):\\/\\/([^)\\s]+)`, 'g'))].map((m) => m[1]))];
}

/* -------------------------------------------------------------------------- */
/* Images                                                                      */
/* -------------------------------------------------------------------------- */

async function convertImage(file: string): Promise<{ data: Buffer; width: number; height: number }> {
  const ext = path.extname(file).toLowerCase();
  // SVG is rasterised: one can carry script, and the bucket serves from its
  // own origin. 300 dpi so the rasterised text stays sharp at 2400 px.
  const input = sharp(file, { limitInputPixels: 400_000_000, ...(ext === '.svg' ? { density: 300 } : {}) });
  // PNGs here are mostly comics, grids and screenshots: text must stay crisp.
  const quality = ext === '.jpg' || ext === '.jpeg' ? 82 : 90;
  const { data, info } = await input
    .rotate()
    .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
    .webp({ quality })
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

async function images() {
  const upload = flag('upload');
  let before = 0;
  let after = 0;
  const failures: string[] = [];
  const entries = Object.entries(imageKeys);
  for (const [i, [rel, key]] of entries.entries()) {
    const src = path.join(planDir!, 'oldsite/static', rel);
    const out = path.join(outDir, key);
    try {
      const { data, width, height } = await convertImage(src);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, data);
      before += fs.statSync(src).size;
      after += data.length;
      if (upload) {
        const { error } = await db.storage.from('media').upload(key, data, {
          contentType: 'image/webp',
          cacheControl: '31536000',
          upsert: true,
        });
        if (error) throw new Error(`upload: ${error.message}`);
        const { error: metaError } = await db
          .from('image_metadata')
          .upsert({ bucket_id: 'media', object_path: key, width, height }, { onConflict: 'bucket_id,object_path' });
        if (metaError) throw new Error(`image_metadata: ${metaError.message}`);
      }
      log({ step: upload ? 'image_uploaded' : 'image_converted', rel, key, width, height, bytes: data.length });
      if ((i + 1) % 25 === 0) console.log(`  ${i + 1}/${entries.length}`);
    } catch (error) {
      failures.push(`${rel}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  console.log(
    `${entries.length - failures.length}/${entries.length} ${upload ? 'uploaded' : 'converted'}; ` +
      `${(before / 1e6).toFixed(0)} MB -> ${(after / 1e6).toFixed(0)} MB`,
  );
  for (const f of failures) console.log('  FAILED', f);
}

/* -------------------------------------------------------------------------- */
/* Articles                                                                    */
/* -------------------------------------------------------------------------- */

async function rowBySlug(slug: string) {
  const { data, error } = await db
    .from('pages')
    .select('page_id, content, publish_at, meta')
    .eq('datasource_alias', ARTICLES_ALIAS)
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as { page_id: string; content: string | null; publish_at: string | null; meta: any } | null;
}

/**
 * Is every image this article uses actually in the bucket? A dry run before
 * the upload checks only the placeholder covers, which are already there.
 */
async function missingMedia(entry: PlanEntry, uploaded: boolean): Promise<string[]> {
  const missing: string[] = [];
  for (const key of mediaRefs(entry, uploaded ? 'legacy|existing' : 'existing')) {
    const res = await fetch(PUBLIC_MEDIA + key, { method: 'HEAD' });
    if (!res.ok) missing.push(key);
  }
  return missing;
}

/**
 * What a fill would replace in the Notion body. Plain paragraphs (a link to
 * the original Google Doc, an editor's note) are returned as text so they can
 * be kept in Editorial Notes; anything else -- an image, a file, a toggle --
 * makes it null, and the page is left alone.
 */
async function notionBodyText(pageId: string): Promise<string | null> {
  const { results, has_more } = await withNotionRetry(() =>
    notion.blocks.children.list({ block_id: pageId, page_size: 50 }),
  );
  if (has_more) return null;
  const lines: string[] = [];
  for (const block of results as any[]) {
    if (block.type !== 'paragraph' || block.has_children) return null;
    const line = (block.paragraph.rich_text ?? [])
      .map((t: any) => (t.href && !t.plain_text.includes(t.href) ? `${t.plain_text} (${t.href})` : t.plain_text))
      .join('')
      .trim();
    if (line) lines.push(line);
  }
  return lines.join('\n');
}

function dateProperties(entry: PlanEntry) {
  return entry.issue
    ? { [ISSUE_PROPERTY]: { select: { name: entry.issue } } }
    : { [WEBSITE_PUBLISH_DATE_PROPERTY]: { date: { start: entry.publish_date! } } };
}

function coverProperty(
  entry: PlanEntry,
): Record<string, { files: { name: string; type: 'external'; external: { url: string } }[] }> {
  if (!entry.cover) return {};
  const url = resolveMedia(entry.cover);
  return { [COVER_PHOTO_PROPERTY]: { files: [{ name: path.basename(url), type: 'external', external: { url } }] } };
}

/**
 * The old site's categories, only for a page with no public tags of its own.
 * Internal tags (`web submission`...) are kept: the site hides them anyway.
 */
function tagsIfNone(props: any, entry: PlanEntry) {
  const current: string[] = (props[TAGS_PROPERTY]?.multi_select ?? []).map((t: any) => t.name);
  if (current.some((t) => !INTERNAL_TAGS.includes(t)) || !entry.tags?.length) return {};
  return { [TAGS_PROPERTY]: { multi_select: [...current, ...entry.tags].map((name) => ({ name })) } };
}

const text = (content: string) => ({ rich_text: [{ text: { content } }] });

async function writeContent(pageId: string, body: string) {
  const { data, error } = await db.from('pages').update({ content: body }).eq('page_id', pageId).select('page_id');
  if (error) throw new Error(`content write failed: ${error.message}`);
  if (!data || data.length !== 1) throw new Error('the sync did not create a row for the page');
}

async function importNew(entry: PlanEntry, body: string): Promise<string> {
  const token = newShareToken();
  const oldLinks = entry.old_urls.map((u) => `tech.caltech.edu${u}`).join(', ');
  const { id: pageId } = await createPageFromMarkdown(notion, {
    dataSourceId: symbiont.config.databases.find((d) => d.alias === ARTICLES_ALIAS)!.dataSourceId,
    properties: {
      [TITLE_PROPERTY]: { title: [{ text: { content: entry.title } }] },
      [SLUG_PROPERTY]: text(entry.slug),
      [AUTHORS_PROPERTY]: { multi_select: (entry.authors ?? []).map((name) => ({ name })) },
      [TAGS_PROPERTY]: { multi_select: (entry.tags ?? []).map((name) => ({ name })) },
      // Published, but no date yet: the publishing gate keeps it hidden until
      // its text is in (sync/hooks/tech.ts).
      [STATUS_PROPERTY]: { status: { name: 'Published' } },
      [WHERE_IS_IT_PROPERTY]: { select: { name: WHERE_IS_IT_WEB_EDITOR } },
      [INFO_PROPERTY]: { rich_text: infoWithEditLink([], shareUrl(token)) },
      [WORD_COUNT_PROPERTY]: text(String(countWordsFromMarkdown(body))),
      [EDITORIAL_NOTES_PROPERTY]: text(`Imported from the old website (${oldLinks}) on 18 October 2026.`),
      ...coverProperty(entry),
    },
    markdown: placeholderBody(shareUrl(token)),
  });
  log({ step: 'page_created', key: entry.key, pageId });
  await syncPage(symbiontSync, ARTICLES_ALIAS, pageId);
  await writeContent(pageId, body);
  await storeShareLinks(pageId, [{ token, readOnly: false }]);
  return pageId;
}

/** Why an existing page must not be filled, or null. Reads only. */
async function fillBlocker(pageId: string): Promise<string | null> {
  const page: any = await withNotionRetry(() => notion.pages.retrieve({ page_id: pageId }));
  const props = page.properties;
  if (props[ISSUE_PROPERTY]?.select || props[WEBSITE_PUBLISH_DATE_PROPERTY]?.date) {
    return 'already dated in Notion, so it may be live';
  }
  if ((await notionBodyText(pageId)) === null) return 'its Notion body has more than plain text';
  return null;
}

async function fillExisting(entry: PlanEntry, body: string, pageId: string): Promise<void> {
  const blocker = await fillBlocker(pageId);
  if (blocker) throw new Error(blocker);
  const page: any = await withNotionRetry(() => notion.pages.retrieve({ page_id: pageId }));
  const props = page.properties;
  // The placeholder replaces the body, so what was there is kept in Editorial
  // Notes. Its existing rich text is re-sent as is: an update replaces it.
  const previous = await notionBodyText(pageId);
  const notes: any[] = (props[EDITORIAL_NOTES_PROPERTY]?.rich_text ?? []).map((t: any) => ({
    type: 'text',
    text: { content: t.plain_text, link: t.href ? { url: t.href } : null },
    annotations: t.annotations,
  }));
  if (previous) {
    notes.push({
      type: 'text',
      text: {
        content: `${notes.length ? '\n' : ''}Notion body before the old-site import: ${previous}`.slice(0, 2000),
      },
    });
  }

  let token = await editLinkForPage(pageId);
  if (!token) {
    token = newShareToken();
    await storeShareLinks(pageId, [{ token, readOnly: false }]);
  }
  // Properties first, so the old body is in Editorial Notes before it goes.
  await withNotionRetry(() =>
    notion.pages.update({
      page_id: pageId,
      properties: {
        [WHERE_IS_IT_PROPERTY]: { select: { name: WHERE_IS_IT_WEB_EDITOR } },
        [INFO_PROPERTY]: { rich_text: infoWithEditLink(props[INFO_PROPERTY]?.rich_text ?? [], shareUrl(token)) },
        [WORD_COUNT_PROPERTY]: text(String(countWordsFromMarkdown(body))),
        ...(previous ? { [EDITORIAL_NOTES_PROPERTY]: { rich_text: notes } } : {}),
        ...tagsIfNone(props, entry),
        ...(props[COVER_PHOTO_PROPERTY]?.files?.length ? {} : coverProperty(entry)),
      },
    } as any),
  );
  await replacePageMarkdown(notion, pageId, placeholderBody(shareUrl(token)));
  // A take-in: it reads the placeholder, marks the row web-owned, and from
  // then on no sync reads the body again.
  await syncPage(symbiontSync, ARTICLES_ALIAS, pageId);
  await writeContent(pageId, body);
}

async function importOne(entry: PlanEntry, write: boolean) {
  const body = resolveMedia(entry.body);
  const existing = await rowBySlug(entry.slug);
  const missing = await missingMedia(entry, write || flag('uploaded'));
  const summary = `${entry.mode.padEnd(4)} /${entry.slug} (${entry.words} words, ${entry.issue ?? entry.publish_date})`;

  if (missing.length) return console.log(`SKIP ${summary}: ${missing.length} image(s) not in the bucket yet`);
  if (entry.mode === 'new' && existing) return console.log(`SKIP ${summary}: a page with this slug exists`);
  if (entry.mode === 'fill' && !existing) return console.log(`SKIP ${summary}: no page with this slug`);
  if (entry.mode === 'fill' && existing!.publish_at) return console.log(`SKIP ${summary}: already public`);
  const blocker = entry.mode === 'fill' ? await fillBlocker(existing!.page_id) : null;
  if (blocker) return console.log(`SKIP ${summary}: ${blocker}`);
  if (!write) return console.log(`WOULD ${summary}${entry.notes.length ? ` -- ${entry.notes.join('; ')}` : ''}`);

  const pageId =
    entry.mode === 'new'
      ? await importNew(entry, body)
      : (await fillExisting(entry, body, existing!.page_id), existing!.page_id);
  log({ step: 'content_written', key: entry.key, pageId });

  // Only now, with the text in place, the date that makes it public.
  await withNotionRetry(() => notion.pages.update({ page_id: pageId, properties: dateProperties(entry) } as any));
  await syncPage(symbiontSync, ARTICLES_ALIAS, pageId);

  const row = await rowBySlug(entry.slug);
  const ok = row?.content === body && Boolean(row?.publish_at);
  log({
    step: ok ? 'done' : 'check_failed',
    key: entry.key,
    pageId,
    publishAt: row?.publish_at,
    contentMatches: row?.content === body,
  });
  console.log(`${ok ? 'DONE' : 'CHECK'} ${summary}${ok ? '' : ' -- re-run verify --repair'}`);
}

async function articles() {
  const write = flag('write');
  const only = value('only')?.split(',');
  const chosen = flag('all') ? plan : plan.filter((p) => only?.includes(p.slug) || only?.includes(p.key));
  if (!chosen.length) throw new Error('nothing chosen: pass --only <slug,...> or --all');
  for (const entry of chosen) {
    try {
      await importOne(entry, write);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log({ step: 'failed', key: entry.key, error: message });
      console.log(`FAIL ${entry.slug}: ${message}`);
    }
    if (write) await sleep(500);
  }
}

/** Tags for fills imported before fills got them. */
async function fillTags() {
  const write = flag('write');
  for (const entry of plan.filter((p) => p.mode === 'fill')) {
    const row = await rowBySlug(entry.slug);
    if (row?.meta?.contentSource !== 'web') continue;
    const page: any = await withNotionRetry(() => notion.pages.retrieve({ page_id: row.page_id }));
    const update = tagsIfNone(page.properties, entry);
    if (!Object.keys(update).length) continue;
    console.log(`${write ? 'TAGGED' : 'WOULD TAG'} /${entry.slug}: ${entry.tags!.join(', ')}`);
    if (!write) continue;
    await withNotionRetry(() => notion.pages.update({ page_id: row.page_id, properties: update } as any));
    await syncPage(symbiontSync, ARTICLES_ALIAS, row.page_id);
  }
}

/** Every imported row still holds its text, and is public. */
async function verify() {
  const repair = flag('repair');
  let bad = 0;
  for (const entry of plan) {
    const row = await rowBySlug(entry.slug);
    if (!row) continue;
    const body = resolveMedia(entry.body);
    if (row.meta?.contentSource !== 'web') continue; // not imported (yet)
    if (row.content !== body) {
      bad++;
      console.log(`${repair ? 'REPAIRED' : 'DIFFERS '} /${entry.slug}`);
      if (repair) await writeContent(row.page_id, body);
    }
    if (!row.publish_at) console.log(`HIDDEN   /${entry.slug}`);
  }
  console.log(bad ? `${bad} differ${repair ? ' (repaired)' : ''}` : 'all imported rows match');
}

const commands: Record<string, () => Promise<void>> = { images, articles, verify, 'fill-tags': fillTags };
if (!commands[command]) throw new Error(`usage: images | articles | verify | fill-tags (got ${command})`);
await commands[command]();

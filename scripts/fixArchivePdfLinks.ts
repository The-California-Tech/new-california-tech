/**
 * Audit and repair the archive's PDF links, in Notion.
 *
 *   pnpm run audit:archive-links                 # report only, writes nothing
 *   pnpm run audit:archive-links -- --limit 25   # check a sample first
 *   pnpm run audit:archive-links -- --apply      # write corrections to Notion
 *   pnpm run audit:archive-links -- --apply --only-encoding
 *
 * Needs NOTION_TOKEN in .env. Notion only -- nothing here touches Supabase,
 * because Supabase is downstream: updating a page in Notion fires the webhook
 * into /api/notion-webhook, which re-syncs that page. If the webhook is not
 * wired up yet, run a sync afterwards instead.
 *
 * ---------------------------------------------------------------------------
 * WHY THE LINKS BROKE
 *
 * Caltech Campus Pubs rebuilt their site. The resolver.caltech.edu permalinks
 * still work -- that is what a resolver is for -- but the direct file URLs
 * previously derived from them changed shape in two ways:
 *
 *   1. The document-number path segment is now zero-padded to two digits.
 *        /3465/1/The%20Hot%20Rivet%202025.pdf   (old, stored)
 *        /3465/01/The%20Hot%20Rivet%202025.pdf  (current)
 *      Some old unpadded paths still resolve, so this is NOT a blanket
 *      rewrite -- each URL has to be checked.
 *
 *   2. Filenames are fully percent-encoded. 107 stored URLs contain literal
 *      spaces, e.g.
 *        /3431/3/The California Tech - September 19%2C 2023 corrected.pdf
 *      Note the comma was escaped but the spaces were not: the signature of
 *      escaping a display filename instead of reading the anchor's href. A
 *      URL with raw spaces is invalid and many clients reject it outright,
 *      independently of the migration.
 *
 * Rather than guess at a rewrite rule, this script treats the resolver
 * landing page as the source of truth: it lists the current file under
 * "Files", and that link is correct by construction. The zero-padding rule is
 * only used as a cheap first guess to avoid a fetch when it already works.
 * ---------------------------------------------------------------------------
 */

// The Notion SDK directly, not symbiont's NotionClient wrapper. symbiont has
// two server barrels: src/lib/server/index.ts exports NotionClient (and the
// rest of the sync class layer), but the published `./server` entry is
// src/lib/server.ts, which does not -- so `import { NotionClient } from
// 'symbiont-cms/server'` does not typecheck, despite what that file's own
// JSDoc says. The other archive scripts use the SDK directly too.
import { Client } from '@notionhq/client';
import { setTimeout as sleep } from 'node:timers/promises';
import 'dotenv/config';

/** The `tech-archives` datasource, per src/lib/symbiont.ts. */
const ARCHIVE_DATA_SOURCE_ID = '3061cbde-6d28-8093-96e0-000bc5d1741a';

const PDF_URL_PROPERTY = 'PDF URL';
const RESOLVER_PROPERTY = 'resolver_url';

/** Be a good citizen: this is a university library, not an API. */
const DELAY_MS = 350;

const args = process.argv.slice(2);
const hasFlag = (n: string) => args.includes(`--${n}`);
const flagValue = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i === -1 ? undefined : args[i + 1];
};

const apply = hasFlag('apply');
const onlyEncoding = hasFlag('only-encoding');
const limit = Number(flagValue('limit') ?? Number.POSITIVE_INFINITY);

const notionToken = process.env.NOTION_TOKEN;
if (!notionToken) {
  console.error('NOTION_TOKEN is not set (expected in .env).');
  process.exit(1);
}

const notion = new Client({ auth: notionToken });

/**
 * Belt and braces on top of the --apply flag: in report mode this is the only
 * function that writes, and it refuses to, so a stray call cannot mutate
 * anything.
 */
async function writeUrlProperty(pageId: string, property: string, url: string): Promise<void> {
  if (!apply) throw new Error('refusing to write in report mode');
  await notion.pages.update({ page_id: pageId, properties: { [property]: { url } } } as any);
}

type Row = { pageId: string; title: string; pdfUrl: string | null; resolverUrl: string | null; eprint: number | null };

function urlProperty(page: any, name: string): string | null {
  const prop = page.properties?.[name];
  if (!prop) return null;
  if (prop.type === 'url') return prop.url || null;
  if (prop.type === 'rich_text') return prop.rich_text.map((t: any) => t.plain_text).join('') || null;
  return null;
}

function titleOf(page: any): string {
  const prop: any = Object.values(page.properties ?? {}).find((p: any) => p.type === 'title');
  return prop?.title?.map((t: any) => t.plain_text).join('') ?? page.id;
}

/**
 * Re-encode the filename segment properly, leaving the rest of the path alone.
 *
 * decode-then-encode normalises whatever mix of raw and escaped characters is
 * currently stored: `The California Tech - September 19%2C 2023.pdf` decodes to
 * a plain filename and re-encodes to the fully-escaped form the new site uses.
 */
function normalizeEncoding(url: string): string {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/');
    const last = segments.pop();
    if (!last) return url;
    let decoded: string;
    try {
      decoded = decodeURIComponent(last);
    } catch {
      decoded = last; // a stray % that is not a valid escape; leave as-is
    }
    segments.push(encodeURIComponent(decoded));
    parsed.pathname = segments.join('/');
    return parsed.toString();
  } catch {
    return url;
  }
}

/** Zero-pad the document-number segment: /3431/3/file.pdf -> /3431/03/file.pdf */
function padDocSegment(url: string): string {
  return url.replace(
    /^(https:\/\/campuspubs\.library\.caltech\.edu\/\d+\/)(\d{1})(\/)/,
    (_m, head, digit, tail) => `${head}0${digit}${tail}`,
  );
}

async function urlWorks(url: string): Promise<boolean> {
  try {
    let res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    // Some static hosts do not answer HEAD; fall back to a 1-byte ranged GET
    // rather than pulling down a whole newspaper issue.
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, { headers: { Range: 'bytes=0-0' }, redirect: 'follow' });
    }
    return res.ok || res.status === 206;
  } catch {
    return false;
  }
}

/** The authoritative current PDF link, read from the resolver landing page. */
async function pdfUrlFromResolver(resolverUrl: string): Promise<string | null> {
  const res = await fetch(resolverUrl, { redirect: 'follow' });
  if (!res.ok) return null;
  const html = await res.text();

  const matches = [...html.matchAll(/href="([^"]+\.pdf)"/gi)].map((m) => m[1]);
  if (matches.length === 0) return null;

  // Resolve against the landing page in case the href is relative, and prefer
  // a campuspubs-hosted file if the page ever links elsewhere.
  const absolute = matches.map((href) => new URL(href, res.url).toString());
  return absolute.find((u) => u.includes('campuspubs.library.caltech.edu')) ?? absolute[0]!;
}

async function fetchArchiveRows(): Promise<Row[]> {
  const rows: Row[] = [];
  let cursor: string | undefined;

  do {
    const res: any = await notion.dataSources.query({
      data_source_id: ARCHIVE_DATA_SOURCE_ID,
      start_cursor: cursor,
    });
    const pages = res.results.filter((p: any) => 'properties' in p);
    for (const page of pages as any[]) {
      rows.push({
        pageId: page.id,
        title: titleOf(page),
        pdfUrl: urlProperty(page, PDF_URL_PROPERTY),
        resolverUrl: urlProperty(page, RESOLVER_PROPERTY),
        // Populated by backfill:eprint-ids. Not needed to repair a link, but it
        // means a row stays identifiable after its URL is rewritten -- so
        // `campuspubs.library.caltech.edu/<eprint>/` is a fallback route to the
        // landing page if a resolver permalink is ever missing.
        eprint: (page as any).properties?.eprint_id?.number ?? null,
      });
    }
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);

  return rows;
}

async function main() {
  console.log(apply ? 'MODE: apply (will write to Notion)\n' : 'MODE: report only (no writes)\n');

  const rows = await fetchArchiveRows();
  console.log(`${rows.length} pages in the archive datasource\n`);

  const candidates = rows
    .filter((r) => r.pdfUrl && r.pdfUrl.includes('campuspubs.library.caltech.edu'))
    .filter((r) => (onlyEncoding ? / /.test(r.pdfUrl!) : true))
    .slice(0, Number.isFinite(limit) ? limit : undefined);

  console.log(`checking ${candidates.length} campuspubs links\n`);

  const fixed: Array<[string, string, string]> = [];
  const unresolved: Row[] = [];
  let alreadyOk = 0;

  for (const [index, row] of candidates.entries()) {
    const stored = row.pdfUrl!;
    const position = `[${index + 1}/${candidates.length}]`;
    await sleep(DELAY_MS);

    // A URL with raw spaces is malformed; do not waste a request confirming it.
    const malformed = / /.test(stored);
    if (!malformed && (await urlWorks(stored))) {
      alreadyOk++;
      continue;
    }

    // Cheap guess first: normalise the encoding and pad the segment.
    const guess = padDocSegment(normalizeEncoding(stored));
    if (guess !== stored && (await urlWorks(guess))) {
      console.log(`  ~ ${position} ${row.title.slice(0, 58)}\n      guess ok: ${guess}`);
      fixed.push([row.pageId, stored, guess]);
      continue;
    }

    // Authoritative fallback: the landing page lists the current file.
    // Reached via the resolver permalink, or -- if that property is empty --
    // straight from the eprint id, which *is* the repository record number, so
    // /<eprint>/ is the same page with one less redirect.
    const landingPage =
      row.resolverUrl ?? (row.eprint ? `https://campuspubs.library.caltech.edu/${row.eprint}/` : null);

    if (!landingPage) {
      unresolved.push(row);
      console.warn(`  ✗ ${position} ${row.title.slice(0, 58)} -- broken, no ${RESOLVER_PROPERTY} and no eprint_id`);
      continue;
    }

    await sleep(DELAY_MS);
    const authoritative = await pdfUrlFromResolver(landingPage).catch(() => null);
    if (!authoritative) {
      unresolved.push(row);
      console.warn(`  ✗ ${position} ${row.title.slice(0, 58)} -- resolver gave no PDF link`);
      continue;
    }

    if (authoritative === stored) {
      alreadyOk++;
      continue;
    }

    console.log(`  → ${position} ${row.title.slice(0, 58)}\n      resolver: ${authoritative}`);
    fixed.push([row.pageId, stored, authoritative]);
  }

  console.log(
    `\nchecked ${candidates.length}: ${alreadyOk} already fine, ${fixed.length} correctable, ${unresolved.length} need a human`,
  );

  if (!apply) {
    console.log('\nReport only. Re-run with --apply to write these to Notion.');
    return;
  }

  let written = 0;
  for (const [pageId, before, after] of fixed) {
    try {
      await writeUrlProperty(pageId, PDF_URL_PROPERTY, after);
      written++;
    } catch (error) {
      console.warn(`  ! failed to update ${pageId}: ${error instanceof Error ? error.message : String(error)}`);
      console.warn(`    was: ${before}`);
    }
  }

  console.log(`\nUpdated ${written} Notion pages.`);
  console.log(
    'Supabase should follow via the Notion webhook. If the webhook is not\n' +
      'wired up yet, trigger a sync so the corrected URLs reach the site.',
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

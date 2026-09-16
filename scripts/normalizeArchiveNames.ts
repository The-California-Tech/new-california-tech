/**
 * Normalize the archive's issue titles in Notion to one canonical shape.
 *
 *   pnpm run normalize:archive-names                # report only (default)
 *   pnpm run normalize:archive-names -- --limit 40  # sample the diff
 *   pnpm run normalize:archive-names -- --apply     # write titles to Notion
 *
 * Needs NOTION_TOKEN in .env. Notion only: Supabase follows via the webhook.
 *
 * ---------------------------------------------------------------------------
 * CANONICAL FORM
 *
 *   California Tech, v. VOL:ISS, Month D, YYYY
 *   California Tech: SUBTITLE, v. VOL:ISS, Month D, YYYY
 *
 * The archive was assembled from campuspubs listings over time and drifted into
 * several shapes: 1799 rows separate the title with a comma but 262 use a bare
 * space; 2002 write the issue as `v. 127:1` while 33 (mostly 2024-25) use
 * `v. 128, no. 9`; subtitles appear three ways -- `: Hot Rivet`, `"Summer"`,
 * and inline before the date. A handful use capital `V.` or omit the space in
 * `v.67`. The majority shape wins in each case.
 *
 * The date is rebuilt from the Date property rather than parsed out of the
 * title, because every one of the 2089 Date values parses cleanly while the
 * dates embedded in titles include ranges, bracketed months and a `March 81`.
 *
 * WHAT IS DELIBERATELY PRESERVED
 *   - Librarian brackets, and *which part* they cover: `v. [90:30]` means both
 *     volume and issue were inferred, `v. [97]:20` means only the volume was.
 *     Flattening these to a single style silently rewrites provenance.
 *   - Non-numeric issue designators: 29½ and 4.5 are interstitial issues,
 *     `Special Edition` is a real designator. They are not errors.
 *   - Subtitle capitalisation, which is the library's, not ours to restyle.
 *
 * Mojibake is repaired: the source has `Â½` for ½ and `Ï€` for π, which is
 * UTF-8 read as Latin-1. Four rows are affected.
 * ---------------------------------------------------------------------------
 */

import { Client } from '@notionhq/client';
import 'dotenv/config';

const ARCHIVE_DATA_SOURCE_ID = '3061cbde-6d28-8093-96e0-000bc5d1741a';
const DATE_PROPERTY = 'Date';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const limitArg = args.indexOf('--limit');
const limit = limitArg === -1 ? Number.POSITIVE_INFINITY : Number(args[limitArg + 1]);

const notionToken = process.env.NOTION_TOKEN;
if (!notionToken) {
  console.error('NOTION_TOKEN is not set (expected in .env).');
  process.exit(1);
}
const notion = new Client({ auth: notionToken });

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

/** UTF-8 bytes that were decoded as Latin-1 round-trip back to the real text. */
function demojibake(value: string): string {
  try {
    const bytes = Uint8Array.from([...value].map((c) => c.charCodeAt(0)));
    if ([...value].some((c) => c.charCodeAt(0) > 0xff)) return value;
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return decoded;
  } catch {
    return value;
  }
}

/** Trailing date-like text, however it happens to be punctuated or bracketed. */
const TAIL = /[,\s]*\[?[A-Z][a-z]+\.?\]?\s*\d{0,2}\s*,?\s*\[?\d{4}\]?\s*\]?\s*$/;

/** Volume/issue in every shape the archive actually contains. */
const VOL =
  /[,\s]*[vV]\.\s*(?:\[(\d+\s*:\s*[^\]]+)\]|\[(\d+)\]\s*:\s*([^,]+?)|(\d+)\s*(?::\s*([^,]+?)|,?\s*no\.\s*([^,[]+?))?)\s*(?=,|$)/;

export function normalizeName(rawName: string, date: Date): { name: string } | { manual: string } {
  const name = demojibake(rawName).trim();
  if (!name.startsWith('California Tech')) return { manual: 'does not start with "California Tech"' };
  // e.g. `v. 144, no. 5.5 [v. 127, no. 10.5]` -- a second citation inside the
  // first. Rewriting these mechanically produces nonsense.
  if (/\[\s*[vV]\./.test(name)) return { manual: 'nested bracketed citation' };
  if (/\d\s*-\s*\d.*\d{4}/.test(name)) return { manual: 'date range in title' };

  const body = TAIL[Symbol.replace](name, '').trim().replace(/[,[\s]+$/, '').trim();
  const m = VOL.exec(body);
  if (!m) return { manual: 'no volume token' };

  const [, bothBracketed, bracketedVol, bracketedVolIssue, plainVol, colonIssue, noIssue] = m;

  let volume: string;
  let issue: string | null;
  let scope: 'all' | 'vol' | 'iss' | null = null;

  if (bothBracketed) {
    const [v, i] = bothBracketed.split(':');
    volume = v!.trim();
    issue = i!.trim();
    scope = 'all';
  } else if (bracketedVol) {
    volume = bracketedVol;
    issue = bracketedVolIssue!.trim();
    scope = 'vol';
  } else {
    volume = plainVol!;
    const raw = (colonIssue ?? noIssue ?? '').trim();
    scope = /^\[.*\]$/.test(raw) ? 'iss' : null;
    issue = raw.replace(/^\[|\]$/g, '') || null;
  }

  const subtitle = (body.slice(0, m.index) + ' ' + body.slice(m.index + m[0].length))
    .replace('California Tech', '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["',:;\-()\s]+|["',:;\-()\s]+$/g, '')
    .trim();

  const head = subtitle ? `California Tech: ${subtitle}` : 'California Tech';
  const when = `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;

  let volumeToken: string;
  if (!issue) volumeToken = `v. ${volume}`;
  else if (scope === 'all') volumeToken = `v. [${volume}:${issue}]`;
  else if (scope === 'vol') volumeToken = `v. [${volume}]:${issue}`;
  else if (scope === 'iss') volumeToken = `v. ${volume}:[${issue}]`;
  else volumeToken = `v. ${volume}:${issue}`;

  return { name: `${head}, ${volumeToken}, ${when}` };
}

function titleOf(page: any): string {
  const prop: any = Object.values(page.properties ?? {}).find((p: any) => p.type === 'title');
  return prop?.title?.map((t: any) => t.plain_text).join('') ?? '';
}

function titlePropertyName(page: any): string {
  return Object.entries(page.properties ?? {}).find(([, p]: any) => p.type === 'title')?.[0] ?? 'Name';
}

function dateOf(page: any): Date | null {
  const start = page.properties?.[DATE_PROPERTY]?.date?.start;
  if (!start) return null;
  const parsed = new Date(start.length <= 10 ? `${start}T00:00:00Z` : start);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function main() {
  console.log(apply ? 'MODE: apply (writes titles to Notion)\n' : 'MODE: report only\n');

  const pages: any[] = [];
  let cursor: string | undefined;
  do {
    const res: any = await notion.dataSources.query({
      data_source_id: ARCHIVE_DATA_SOURCE_ID,
      start_cursor: cursor,
    });
    pages.push(...res.results.filter((p: any) => 'properties' in p));
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);

  console.log(`${pages.length} pages in the archive datasource\n`);

  const changes: Array<{ id: string; prop: string; from: string; to: string }> = [];
  const manual: Array<[string, string]> = [];
  const byDate = new Map<string, string[]>();
  let unchanged = 0;

  for (const page of pages) {
    const current = titleOf(page);
    const date = dateOf(page);
    if (!date) {
      manual.push([current, 'no Date property']);
      continue;
    }

    const key = date.toISOString().slice(0, 10);
    byDate.set(key, [...(byDate.get(key) ?? []), current]);

    const result = normalizeName(current, date);
    if ('manual' in result) manual.push([current, result.manual]);
    else if (result.name !== current) {
      changes.push({ id: page.id, prop: titlePropertyName(page), from: current, to: result.name });
    } else unchanged++;
  }

  const shown = changes.slice(0, Number.isFinite(limit) ? limit : undefined);
  for (const c of shown) {
    console.log(`  -  ${c.from}`);
    console.log(`  +  ${c.to}\n`);
  }

  console.log(`${unchanged} already canonical, ${changes.length} to rewrite, ${manual.length} need a human`);
  if (manual.length) {
    console.log('\nManual:');
    for (const [name, why] of manual) console.log(`  [${why}] ${name}`);
  }

  // Slugs for the archive are the ISO date, and public.pages has
  // UNIQUE(datasource_alias, slug) -- so on a colliding date only one row ever
  // reaches the database. Renaming does not fix this; it is reported so the
  // count stays visible until the slug scheme handles it.
  const collisions = [...byDate.entries()].filter(([, v]) => v.length > 1);
  if (collisions.length) {
    console.log(`\n${collisions.length} dates carry more than one issue (slug collisions):`);
    for (const [date, titles] of collisions.sort()) {
      console.log(`  ${date}`);
      for (const t of titles) console.log(`      ${t}`);
    }
  }

  if (!apply) {
    console.log('\nReport only. Re-run with --apply to write these titles.');
    return;
  }

  let written = 0;
  for (const c of changes) {
    try {
      // Note: symbiont's NotionClient.updateProperty always writes rich_text,
      // so it cannot set a title. Hence the direct SDK call here.
      await notion.pages.update({
        page_id: c.id,
        properties: { [c.prop]: { title: [{ type: 'text', text: { content: c.to } }] } },
      } as any);
      written++;
    } catch (error) {
      console.warn(`  ! ${c.from}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  console.log(`\nRewrote ${written} titles. Supabase follows via the Notion webhook.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

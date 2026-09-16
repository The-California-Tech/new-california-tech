/**
 * Add an `eprint_id` column to the archive datasource and populate it.
 *
 *   pnpm run backfill:eprint-ids              # report only (default)
 *   pnpm run backfill:eprint-ids -- --apply   # create the column and fill it
 *
 * Needs NOTION_TOKEN in .env, with permission to edit the datasource schema.
 *
 * ---------------------------------------------------------------------------
 * RUN THIS FIRST -- BEFORE ANY OTHER ARCHIVE SCRIPT
 *
 * The campuspubs eprint id is the only stable per-issue key the archive has:
 * titles are the thing being normalised, dates turn out to be wrong often
 * enough that four of them are being corrected, and Notion page ids are absent
 * from CSV exports. But right now the eprint id exists *only* embedded in the
 * `PDF URL` string -- and every other script in this directory is about to
 * rewrite or clear that URL. Repairing a link, or clearing it to await a
 * hand-made concatenation, destroys the only handle on the row.
 *
 * Promoting it to its own column fixes that permanently: the fixup scripts
 * become idempotent and re-runnable, and a future library migration is a
 * lookup rather than an archaeology exercise.
 *
 * Order:
 *   0. pnpm run backfill:eprint-ids     <- this script
 *   1. pnpm run audit:archive-links
 *   2. pnpm run fixup:archive
 *   3. pnpm run normalize:archive-names
 *
 * WHY NOT JUST USE resolver_url
 * The resolver permalink is the more durable pointer and is kept for that
 * reason, but it is opaque -- `CaltechCampusPubs:20230919-210834755` has to be
 * fetched to learn anything. The eprint id *is* the repository's record number,
 * so `campuspubs.library.caltech.edu/<eprint>/` is the landing page directly,
 * with no redirect, and it doubles as a compact join key. The two are
 * complementary, not redundant.
 *
 * Roughly 17 rows have no eprint id and never will: they are recent issues the
 * Tech published itself, hosted in Supabase storage rather than deposited with
 * the library. Those are reported, not treated as failures.
 * ---------------------------------------------------------------------------
 */

import { Client } from '@notionhq/client';
import 'dotenv/config';

const ARCHIVE_DATA_SOURCE_ID = '3061cbde-6d28-8093-96e0-000bc5d1741a';
const EPRINT_PROPERTY = 'eprint_id';
const PDF_URL_PROPERTY = 'PDF URL';

const args = process.argv.slice(2);
const apply = args.includes('--apply');

const notionToken = process.env.NOTION_TOKEN;
if (!notionToken) {
  console.error('NOTION_TOKEN is not set (expected in .env).');
  process.exit(1);
}
const notion = new Client({ auth: notionToken });

function titleOf(page: any): string {
  const prop: any = Object.values(page.properties ?? {}).find((p: any) => p.type === 'title');
  return prop?.title?.map((t: any) => t.plain_text).join('') ?? page.id;
}

/** The library's record number, as embedded in a campuspubs file URL. */
export function eprintFromUrl(url: string | null | undefined): number | null {
  const match = url?.match(/campuspubs\.library\.caltech\.edu\/(\d+)\//);
  return match ? Number(match[1]) : null;
}

async function main() {
  console.log(apply ? 'MODE: apply (creates the column and writes values)\n' : 'MODE: report only\n');

  const dataSource: any = await notion.dataSources.retrieve({ data_source_id: ARCHIVE_DATA_SOURCE_ID });
  const existing = dataSource.properties?.[EPRINT_PROPERTY];

  if (existing) {
    console.log(`"${EPRINT_PROPERTY}" already exists (type: ${existing.type})`);
    if (existing.type !== 'number') {
      console.warn(`  ! expected type "number"; reading will still work but writes below assume number`);
    }
  } else if (apply) {
    // Additive: adding a property cannot affect existing values.
    await notion.dataSources.update({
      data_source_id: ARCHIVE_DATA_SOURCE_ID,
      properties: { [EPRINT_PROPERTY]: { number: {} } },
    } as any);
    console.log(`created "${EPRINT_PROPERTY}" (number)`);
  } else {
    console.log(`"${EPRINT_PROPERTY}" does not exist yet -- --apply would create it as a number column`);
  }

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

  console.log(`\n${pages.length} pages in the archive datasource\n`);

  const toWrite: Array<[any, number]> = [];
  const alreadySet: any[] = [];
  const noEprint: any[] = [];
  const conflicting: Array<[any, number, number]> = [];

  for (const page of pages) {
    const current: number | null = page.properties?.[EPRINT_PROPERTY]?.number ?? null;
    const derived = eprintFromUrl(page.properties?.[PDF_URL_PROPERTY]?.url);

    if (current !== null && derived !== null && current !== derived) {
      conflicting.push([page, current, derived]);
    } else if (current !== null) {
      alreadySet.push(page);
    } else if (derived !== null) {
      toWrite.push([page, derived]);
    } else {
      noEprint.push(page);
    }
  }

  console.log(`${alreadySet.length} already populated`);
  console.log(`${toWrite.length} to populate from the PDF URL`);
  console.log(`${noEprint.length} have no derivable eprint id (expected: self-published issues)`);
  if (conflicting.length) console.log(`${conflicting.length} CONFLICT with the URL -- not touched`);

  if (noEprint.length) {
    console.log('\nNo eprint id:');
    for (const page of noEprint) {
      const url = page.properties?.[PDF_URL_PROPERTY]?.url ?? '(no PDF URL)';
      const host = url.startsWith('http') ? new URL(url).host : url;
      console.log(`   ${titleOf(page).slice(0, 62)}  [${host}]`);
    }
  }

  if (conflicting.length) {
    console.log('\nConflicts (existing value disagrees with the URL -- resolve by hand):');
    for (const [page, current, derived] of conflicting) {
      console.log(`   ${titleOf(page).slice(0, 58)}\n      column=${current}  url=${derived}`);
    }
  }

  if (!apply) {
    console.log('\nReport only. Re-run with --apply to create the column and populate it.');
    return;
  }

  let written = 0;
  for (const [page, eprint] of toWrite) {
    try {
      await notion.pages.update({
        page_id: page.id,
        properties: { [EPRINT_PROPERTY]: { number: eprint } },
      } as any);
      written++;
    } catch (error) {
      console.warn(`  ! ${titleOf(page)}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(`\nPopulated ${written} rows.`);
  console.log('The other archive scripts now key off this column and are safe to re-run.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

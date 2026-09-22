/**
 * Apply the hand-adjudicated fixes to the archive in Notion.
 *
 *   pnpm run fixup:archive              # report only (default)
 *   pnpm run fixup:archive -- --apply   # write to Notion
 *
 * Needs NOTION_TOKEN in .env. Notion only; Supabase follows via the webhook.
 *
 * ---------------------------------------------------------------------------
 * RUN ORDER MATTERS
 *
 *   1. pnpm run audit:archive-links   -- repairs campuspubs PDF URLs
 *   2. pnpm run fixup:archive         -- this script (dates + duplicates)
 *   3. pnpm run normalize:archive-names
 *   4. then, by hand: concatenate the PDFs listed under MANUAL below and
 *      upload each to the surviving Notion row
 *
 * (1) and (2) both identify rows by the campuspubs eprint id parsed out of the
 * PDF URL, so they must run before any PDF is replaced -- re-uploading changes
 * the URL and the id disappears. (3) runs after (2) because titles are rebuilt
 * from the Date property, and two of the dates are wrong until (2) fixes them.
 *
 * WHY EPRINT ID AS THE KEY
 * The Notion export carries no page ids, and titles are exactly the thing being
 * normalised, so neither is a stable handle. The eprint id is the library's own
 * identifier, is unique per row, and is visible in the stored PDF URL.
 *
 * NOTE ON ARCHIVING
 * Duplicates are archived (sent to Notion's trash), not deleted -- recoverable
 * if an adjudication turns out wrong. No matching Supabase row has to be
 * cleaned up afterwards: the loser of a colliding date never had one, because
 * public.pages has UNIQUE(datasource_alias, slug) and the slug is the date, so
 * only one of the pair was ever synced.
 * ---------------------------------------------------------------------------
 */

import { Client } from '@notionhq/client';
import 'dotenv/config';

const ARCHIVE_DATA_SOURCE_ID = '3061cbde-6d28-8093-96e0-000bc5d1741a';

/** Rows that are the same issue scanned twice. Archive the listed eprint. */
const DUPLICATES: Array<{ archive: string; keep: string; note: string }> = [
  { archive: '407', keep: '406', note: '1955-11-10 v.57:7 scanned twice' },
  { archive: '671', keep: '670', note: '1965-12-09 v.67:11 scanned twice' },
  { archive: '1370', keep: '1369', note: '1974-04-05 v.75:22 scanned twice' },
  { archive: '3381', keep: '1148', note: '1978-06-02 The New Techer, identical' },
  { archive: '3391', keep: '1428', note: '1989-07-26 Summer v.91:ii, identical' },
  { archive: '3390', keep: '1429', note: '1989-08-23 Summer v.91:iii, identical' },
  { archive: '1611', keep: '1610', note: '1992-10-30 v.94:6 scanned twice' },
  { archive: '1634', keep: '1633', note: '1993-10-15 v.95:4 scanned twice' },
  { archive: '1655', keep: '1652', note: '1997-09-19 v.99:1 scanned twice' },
];

/**
 * Dates the library recorded wrongly. Correcting these dissolves the collision
 * without losing either issue, and the title follows automatically because
 * normalizeArchiveNames rebuilds the date from this property.
 */
const DATE_CORRECTIONS: Array<{ eprint: string; to: string; note: string }> = [
  { eprint: '603', to: '1962-02-22', note: 'v.63:18 is Feb 22; library title says Feb 15' },
  { eprint: '1144', to: '1978-05-05', note: 'v.79:31 is May 5, not Apr 28' },
  { eprint: '800', to: '1968-10-17', note: 'v.70:4 is Oct 17; 1968_10_10_70_04 was mis-dated' },
  { eprint: '1723', to: '1999-12-22', note: '"Octember 22" is December 22' },
];

/**
 * Two physical pieces that belong to one issue. The PDFs get concatenated by
 * hand and uploaded to the surviving row; the others are archived here.
 */
const MERGES: Array<{ keep: string; archive: string[]; note: string }> = [
  { keep: '795', archive: ['3382'], note: '1968-05-29: Hot Throbbing Rivet was the centerfold of v.69:30' },
  { keep: '1211', archive: ['1212'], note: '1977-06-03: keep the Technical Intruder row' },
  { keep: '1341', archive: ['1335'], note: '1986-05-30: fold the Ditch Day Supplement into v.87:30' },
  { keep: '1533', archive: ['3379', '1532'], note: '1988-06-03: the two Magazine rows duplicate each other' },
  { keep: '1744', archive: ['1745'], note: '1994-03-11: keep the Moby Dick row' },
];

/**
 * Titles the normaliser cannot derive, resolved by hand. Applied verbatim.
 */
const NAME_OVERRIDES: Array<{ eprint: string; to: string; note: string }> = [
  {
    eprint: '1889',
    to: 'California Tech, v. 101:23, April 21, 2000',
    // The library's filename for this one is 2000_04_28_00_00.pdf, so its true
    // date is genuinely uncertain. Keeping April 21 as recorded, deliberately.
    note: 'bracket swallowed the date; volume is 101, issue 23',
  },
  {
    eprint: '982',
    to: 'California Tech: Los Angeles Free Pest, v. 68, June 1, 1967',
    note: 'title carried a June 1-7 range; use June 1',
  },
  {
    eprint: '3442',
    to: 'California Tech: The Tech (April Fools Joke Issue), v. 144:5.5, April 1, 2024',
    note: 'it is The Tech v.144:5.5; drop the [v. 127, no. 10.5] cross-reference',
  },
];

/**
 * All 18 colliding dates are adjudicated. Two loose ends were resolved by
 * inspection rather than by rule, and are recorded here so the reasoning is not
 * lost:
 *
 *   1968-10-10  Looked like a merge, but v.70:4 (eprint 800) is simply
 *               mis-dated -- it is October 17 -- so it is a DATE_CORRECTIONS
 *               entry and both issues survive, same as v.63:18 and v.79:31.
 *
 *   eprint 1889 Notion dates it 2000-04-21 while the library's filename says
 *               2000_04_28. Genuinely unclear, so April 21 stands as recorded.
 */
const UNRESOLVED: string[] = [];

/**
 * Rows whose PDF must be replaced by hand with a concatenation of the merged
 * pieces. Clearing `PDF URL` is the point: it leaves a visible hole in Notion
 * rather than a link to only one half of the issue.
 *
 * Consequences, all intended:
 *   - archives:metadata:resolver writes meta.resolver_url = null, so
 *     /issues/<date>.pdf serves 404 for these five until a PDF is uploaded.
 *   - archives:cover has nothing to render, so these issues show no cover.
 *
 * `resolver_url` is deliberately NOT cleared. That property holds the
 * resolver.caltech.edu permalink -- the one link that survived the library's
 * migration and the only durable pointer back to the source record. Clearing it
 * would throw away the thing that makes a future repair a re-run instead of an
 * investigation.
 */
const CLEAR_PDF_URL = MERGES.map((m) => m.keep);

/**
 * `Notes` was scaffolding: it held the library's blurb purely so the issue date
 * could be extracted from its text, and nothing reads it now -- the archive
 * hooks use Date, PDF, PDF URL, Issue and Status, and a grep for 'Notes' across
 * src/ finds nothing. So it is cleared wholesale and repurposed as the place
 * where an adjudication is recorded, on the row that survives it.
 *
 * Derived from the tables above rather than written out separately, so a change
 * to a decision cannot leave a stale note behind.
 */
function buildNotes(): Map<string, string[]> {
  const notes = new Map<string, string[]>();
  const add = (eprint: string, text: string) => notes.set(eprint, [...(notes.get(eprint) ?? []), text]);

  for (const d of DUPLICATES) add(d.keep, `Duplicate scan (eprint ${d.archive}) archived — ${d.note}.`);
  for (const m of MERGES) {
    add(
      m.keep,
      `PDF pending: upload a concatenation of this issue and eprint ${m.archive.join(' + ')} — ` +
        `${m.note}. PDF URL was cleared to make the gap visible.`,
    );
  }
  for (const c of DATE_CORRECTIONS) add(c.eprint, `Date corrected to ${c.to} — ${c.note}.`);
  for (const n of NAME_OVERRIDES) add(n.eprint, `Title set by hand — ${n.note}.`);

  add(
    '1889',
    'Date uncertain: the library filename reads 2000_04_28 while the record says April 21. April 21 retained.',
  );

  return notes;
}

const args = process.argv.slice(2);
const apply = args.includes('--apply');
/** Clearing Notes touches every row, so it is separable from the rest. */
const skipNotes = args.includes('--skip-notes');
const NOTES_PROPERTY = 'Notes';

const notionToken = process.env.NOTION_TOKEN;
if (!notionToken) {
  console.error('NOTION_TOKEN is not set (expected in .env).');
  process.exit(1);
}
const notion = new Client({ auth: notionToken });

/**
 * Prefer the `eprint_id` column, falling back to parsing the PDF URL.
 *
 * The column is what makes this script re-runnable: repairing or clearing a
 * PDF URL destroys the embedded id. Run `pnpm run backfill:eprint-ids` first
 * and the fallback stops mattering.
 */
function eprintOf(page: any): string | null {
  const column = page.properties?.['eprint_id']?.number;
  if (typeof column === 'number') return String(column);

  const url: string | undefined = page.properties?.['PDF URL']?.url ?? undefined;
  const match = url?.match(/campuspubs\.library\.caltech\.edu\/(\d+)\//);
  return match?.[1] ?? null;
}

function notesTextOf(page: any): string {
  const prop = page.properties?.[NOTES_PROPERTY];
  if (prop?.type !== 'rich_text') return '';
  return prop.rich_text.map((t: any) => t.plain_text).join('');
}

function titleOf(page: any): string {
  const prop: any = Object.values(page.properties ?? {}).find((p: any) => p.type === 'title');
  return prop?.title?.map((t: any) => t.plain_text).join('') ?? '';
}

function titlePropertyName(page: any): string {
  return Object.entries(page.properties ?? {}).find(([, p]: any) => p.type === 'title')?.[0] ?? 'Name';
}

async function main() {
  console.log(apply ? 'MODE: apply (writes to Notion)\n' : 'MODE: report only\n');

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

  const byEprint = new Map<string, any>();
  for (const page of pages) {
    const id = eprintOf(page);
    if (id) byEprint.set(id, page);
  }
  console.log(`${pages.length} pages, ${byEprint.size} with a resolvable eprint id\n`);

  const missing: string[] = [];
  const lookup = (eprint: string) => {
    const page = byEprint.get(eprint);
    if (!page) missing.push(eprint);
    return page;
  };

  const toArchive: Array<[any, string]> = [];
  const toRedate: Array<[any, string, string]> = [];
  const toRename: Array<[any, string, string]> = [];
  const toClear: Array<[any, string]> = [];

  for (const d of DUPLICATES) {
    const page = lookup(d.archive);
    if (page) toArchive.push([page, `duplicate of ${d.keep} -- ${d.note}`]);
  }
  for (const m of MERGES) {
    for (const eprint of m.archive) {
      const page = lookup(eprint);
      if (page) toArchive.push([page, `merged into ${m.keep} -- ${m.note}`]);
    }
  }
  for (const c of DATE_CORRECTIONS) {
    const page = lookup(c.eprint);
    if (page) toRedate.push([page, c.to, c.note]);
  }
  for (const n of NAME_OVERRIDES) {
    const page = lookup(n.eprint);
    if (page) toRename.push([page, n.to, n.note]);
  }
  for (const eprint of CLEAR_PDF_URL) {
    const page = lookup(eprint);
    const current = page?.properties?.['PDF URL']?.url;
    // Already cleared by a previous run -- nothing to do, and saying so is
    // more useful than reporting a no-op write.
    if (page && current) toClear.push([page, current]);
  }

  console.log(`ARCHIVE (${toArchive.length}):`);
  for (const [page, why] of toArchive) console.log(`   ${titleOf(page)}\n      ${why}`);
  console.log(`\nRE-DATE (${toRedate.length}):`);
  for (const [page, to, why] of toRedate) console.log(`   ${titleOf(page)}\n      -> ${to}   (${why})`);
  console.log(`\nRENAME (${toRename.length}):`);
  for (const [page, to, why] of toRename) console.log(`   ${titleOf(page)}\n      -> ${to}\n      (${why})`);
  console.log(`\nCLEAR "PDF URL" (${toClear.length}) -- awaiting a hand-made concatenation:`);
  for (const [page, was] of toClear) console.log(`   ${titleOf(page)}\n      was: ${was}`);

  // Notes: wipe the library blurb everywhere, then write the adjudication onto
  // the rows it applies to.
  const notes = buildNotes();
  const toSetNotes: Array<[any, string]> = [];
  const toWipeNotes: any[] = [];

  if (!skipNotes) {
    for (const page of pages) {
      const eprint = eprintOf(page);
      const comment = eprint ? notes.get(eprint)?.join(' ') : undefined;
      const current = notesTextOf(page);
      if (comment) {
        if (current !== comment) toSetNotes.push([page, comment]);
      } else if (current) {
        toWipeNotes.push(page);
      }
    }

    console.log(`\nNOTES: ${toWipeNotes.length} to clear, ${toSetNotes.length} to annotate`);
    for (const [page, comment] of toSetNotes) console.log(`   ${titleOf(page).slice(0, 56)}\n      "${comment}"`);
    const unmatched = [...notes.keys()].filter((e) => !byEprint.has(e));
    if (unmatched.length) console.log(`   ! no row found for eprint ${unmatched.join(', ')}`);
  } else {
    console.log('\nNOTES: skipped (--skip-notes)');
  }

  if (missing.length) {
    console.log(`\n!! ${missing.length} eprint ids not found in Notion: ${missing.join(', ')}`);
    console.log('   Expected on a second run: clearing "PDF URL" removes the eprint id this');
    console.log('   script matches on, so the five merge survivors go missing once applied.');
    console.log('   Also expected if a PDF has already been re-uploaded.');
  }

  console.log('\nMANUAL -- concatenate these PDFs and upload to the surviving row:');
  for (const m of MERGES) console.log(`   keep ${m.keep}, fold in ${m.archive.join(' + ')} -- ${m.note}`);
  console.log('\nSTILL UNRESOLVED:');
  for (const u of UNRESOLVED) console.log(`   ${u}`);

  if (!apply) {
    console.log('\nReport only. Re-run with --apply to write.');
    return;
  }

  for (const [page, why] of toArchive) {
    await notion.pages.update({ page_id: page.id, archived: true } as any);
    console.log(`  archived: ${titleOf(page)}  (${why})`);
  }
  for (const [page, to] of toRedate) {
    await notion.pages.update({ page_id: page.id, properties: { Date: { date: { start: to } } } } as any);
    console.log(`  re-dated: ${titleOf(page)} -> ${to}`);
  }
  for (const [page, to] of toRename) {
    await notion.pages.update({
      page_id: page.id,
      properties: { [titlePropertyName(page)]: { title: [{ type: 'text', text: { content: to } }] } },
    } as any);
    console.log(`  renamed: ${to}`);
  }
  for (const [page, comment] of toSetNotes) {
    await notion.pages.update({
      page_id: page.id,
      properties: { [NOTES_PROPERTY]: { rich_text: [{ type: 'text', text: { content: comment } }] } },
    } as any);
  }
  if (toSetNotes.length) console.log(`  annotated ${toSetNotes.length} rows`);

  if (toWipeNotes.length) {
    console.log(
      `  clearing Notes on ${toWipeNotes.length} rows (Notion allows ~3 writes/sec, so expect a few minutes)`,
    );
    let wiped = 0;
    for (const page of toWipeNotes) {
      await notion.pages.update({
        page_id: page.id,
        properties: { [NOTES_PROPERTY]: { rich_text: [] } },
      } as any);
      if (++wiped % 250 === 0) console.log(`    ${wiped}/${toWipeNotes.length}`);
    }
    console.log(`  cleared ${wiped}`);
  }

  // Last, deliberately: this erases the eprint id embedded in the PDF URL, so
  // anything that falls back to parsing it must already have run. Harmless once
  // backfill:eprint-ids has populated the column.
  for (const [page, was] of toClear) {
    await notion.pages.update({ page_id: page.id, properties: { 'PDF URL': { url: null } } } as any);
    console.log(`  cleared PDF URL: ${titleOf(page)}  (was ${was})`);
  }

  console.log('\nDone. Supabase follows via the Notion webhook.');
  if (toClear.length) {
    console.log(
      `\n${toClear.length} rows now have an empty "PDF URL" and are waiting on you:\n` +
        MERGES.map((m) => `   ${m.note}`).join('\n') +
        '\nUntil each is uploaded, /issues/<date>.pdf serves 404 for that issue and it\n' +
        'renders without a cover. Their resolver_url permalinks are untouched, so the\n' +
        'source records are still reachable.',
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

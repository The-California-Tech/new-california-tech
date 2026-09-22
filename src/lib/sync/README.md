# `src/lib/sync`

Everything that runs while pulling content **from Notion into Postgres**.
Nothing here executes when a reader loads a page.

The rest of `src/lib` is the opposite: components, stores, and the utilities
that turn a database row into something on screen.

## Why the split is worth keeping

These two halves have almost nothing in common. They run at different times, in
different processes, against different failure modes — a sync failure is an
editor waiting for their article to appear, a render failure is a reader seeing
a broken page. They also have different constraints: sync code talks to a
rate-limited third-party API and must be idempotent; render code must not ship
a kilobyte it does not need.

The dependency graph already respected that boundary before this directory
existed — no file here imports a component, and no component imports a hook.
The directory just makes it visible, so the next person does not have to
reconstruct it by reading imports.

## What lives here

| file                        | what it does                                                                                                                                    |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `properties.ts`             | Every Notion column name, defined once. See below.                                                                                              |
| `date-parser.ts`            | Strict parsing of `Issue` and `Website Publish Date`.                                                                                           |
| `reconcile-layout.ts`       | Pure: decides what the `Layout` preset and the granular columns should do about each other. No I/O, so it is testable without a Notion account. |
| `hooks/tech.ts`             | The main hook set: publish gate, print-only exclusion, metadata, word count.                                                                    |
| `hooks/sync-note.ts`        | Writes the `[sync]` status line to `Sync Status`.                                                                                               |
| `hooks/layout-expansion.ts` | Applies `reconcile-layout`'s decision to Notion.                                                                                                |

`symbiont.server.ts` stays at the `lib` root: it is the boundary object that
wires these hooks to datasources, and SvelteKit routes import it directly.

## `properties.ts` is not optional ceremony

Column names were once declared in whichever file needed them. Renaming `Byline`
to `Byline Layout` in one file left another reading a column that no longer
existed — and that fails **silently**, because a missing Notion property reads
as blank, and blank is a legitimate value throughout this code. One definition
each is the fix.

## What is deliberately _not_ here

`utils/layout-preset.ts` is shared vocabulary, not sync machinery. The presets
and their normalisers are read by the hooks (interpreting Notion) _and_ by
`post-converter` and the components (rendering the result). Moving it in would
mean the render path imports from `sync/`, which is exactly the coupling this
directory exists to make obvious.

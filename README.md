# The California Tech

A SvelteKit-powered site for The California Tech, using Notion/Supabase sync via Symbiont and QWER content tooling.

## Development

Prerequisites:

- Node.js 18+ (22+ if you need the Google Doc importer — `googleapis` requires it)
- pnpm

Install:

```bash
pnpm install
```

Run locally:

```bash
pnpm dev
```

## Build

```bash
pnpm build
pnpm preview
```

## Importing a Google Doc into Notion

Articles that arrive as Google Docs can be pushed straight into Notion with
their images intact:

```bash
pnpm run gdoc:login                                  # once per Google account
pnpm run import:gdoc -- <doc-url>                    # → tech-article-staging
pnpm run import:gdoc -- <doc-url> --db tech-website-pages
pnpm run import:gdoc -- <doc-url> --into TECH-675    # append to an existing page
```

`--into` appends the Doc to the end of an existing page's body rather than
creating a new one, and accepts a page URL, a UUID, or a short ID like
`TECH-675` (the `unique_id` property Notion renders as `PREFIX-N`). Add
`--overwrite` to replace that page's content instead of appending — useful for
re-importing after edits in the Doc. Notion still refuses to delete child pages
or databases, so `--overwrite` fails loudly rather than eating them.

Exporting a Doc as Markdown and importing that by hand works for the text, but
Google embeds **downscaled** copies of the images as base64 in the reference
definitions at the bottom of the file — that is where the quality goes. The
script takes two exports of the same Doc (Markdown for the text, the HTML zip
for the images Google actually stores) and reconciles them, then uploads each
image to Notion at full size.

The one ceiling you cannot beat: Google downsamples anything over ~2000px on
the long edge when the image is _inserted_ into the Doc. Nothing recovers what
was discarded then, so keep originals elsewhere if it matters.

Needs `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `.env` (see `.env.example`)
plus the existing `NOTION_TOKEN`. Sign in once per Google account — docs shared
with only one of your addresses still work, because every signed-in account is
tried against the doc until one can open it. Refresh tokens are stored in
`~/.config/california-tech/`, never in the repo.

Other flags: `--title`, `--account`, `--dump <dir>` to keep the intermediates,
and `--md <file>` to skip Notion entirely and write a Markdown file with
full-resolution images for dragging in by hand. See `scripts/importGoogleDoc.ts`
for the rest.

## Deployment

This repository is configured for deployment on Vercel with `@sveltejs/adapter-vercel`.

## Credits

This project is based on and includes components/tooling from:

- QWER by kwchang0831: https://github.com/kwchang0831/svelte-QWER

Please review QWER's repository for upstream documentation and history.

## License

This repository is licensed under the MIT License. See `LICENSE`.

If you redistribute or reuse portions derived from QWER, keep the original notices and attribution in accordance with the upstream license requirements.

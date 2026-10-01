#!/usr/bin/env bash
# Regenerate src/lib/types/database.types.ts from the database schema.
#
#   pnpm db:types           # local Supabase -- i.e. the migrations in git
#   pnpm db:types:linked    # production
#
# Formatted with the repo's Prettier afterwards: the CLI's own formatting is not
# stable across versions (v2.116 formats; later versions emit unformatted output
# with a hint to run oxfmt), and the file is not Prettier-ignored.
#
# --local and --linked can differ slightly in content, not only layout -- e.g.
# the generated search_fts column is `never` on insert from one and `unknown`
# from the other. Neither is wrong to commit. CI regenerates with --local and
# type-checks the app against that (see .github/workflows/ci.yml), so what has
# to be right is the code, not the bytes of this file.
set -euo pipefail

source_flag="${1:---local}"
out="src/lib/types/database.types.ts"

supabase gen types typescript "$source_flag" --schema public > "$out"
pnpm exec prettier --write --log-level warn "$out"

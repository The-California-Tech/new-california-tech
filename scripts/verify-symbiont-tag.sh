#!/usr/bin/env bash
#
# Prove that `github:guutz/symbiont-cms#<tag>` actually installs into something
# usable, in a throwaway directory, without touching this project.
#
#   bash scripts/verify-symbiont-tag.sh            # checks the tag in package.json
#   bash scripts/verify-symbiont-tag.sh v1.1.2     # checks a specific tag
#
# WHY THIS EXISTS
#   symbiont-cms's package.json points every export at ./dist/*, but dist/ is
#   gitignored and is not committed at any tag. A git install therefore has to
#   build the package itself. `prepare` is only `svelte-kit sync`, which does not
#   emit dist; `prepack` (svelte-package) is what does, and whether pnpm runs it
#   while preparing a git dependency is version-dependent.
#
#   Net effect: the tagged dependency may install "successfully" and still be
#   unimportable. Local development hid this completely, because node_modules/
#   symbiont-cms was a symlink to a checkout that had a built dist/ sitting in it.
#
#   Run this before trusting any deploy. If it fails, the fix is in symbiont-cms,
#   not here -- either commit dist/ at release tags (what
#   .docs/2026-04-03-symbiont-git-tag-release-playbook.md decided) or publish a
#   prebuilt tarball to a registry.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ $# -ge 1 ]; then
  TAG="$1"
else
  TAG="$(node -p "
    const d = require('$REPO_ROOT/package.json');
    const all = { ...(d.dependencies||{}), ...(d.devDependencies||{}) };
    const s = all['symbiont-cms'] || '';
    const m = s.match(/#(.+)$/);
    m ? m[1] : ''
  ")"
fi

if [ -z "$TAG" ]; then
  echo "error: could not determine a tag; pass one explicitly." >&2
  exit 1
fi

PROBE="$(mktemp -d)"
trap 'rm -rf "$PROBE"' EXIT

echo "Probing symbiont-cms#$TAG in $PROBE"
echo

# Pin the probe to the same pnpm the consumer runs. Without a packageManager
# field corepack falls back to its own default (a different major), so the probe
# would not reproduce the consumer's install behaviour -- and git-dependency
# preparation is exactly where pnpm versions differ.
PNPM_VERSION="$(pnpm --version 2>/dev/null || echo '')"
if [ -n "$PNPM_VERSION" ]; then
  PM_FIELD="\"packageManager\": \"pnpm@${PNPM_VERSION}\","
else
  PM_FIELD=""
fi

cat > "$PROBE/package.json" <<EOF
{
  "name": "symbiont-tag-probe",
  "private": true,
  "type": "module",
  ${PM_FIELD}
  "dependencies": {
    "symbiont-cms": "github:guutz/symbiont-cms#$TAG"
  }
}
EOF

# Mirror the consumer's build allowlist, so this reproduces a real install.
cat > "$PROBE/pnpm-workspace.yaml" <<'EOF'
allowBuilds:
  symbiont-cms@git+https://github.com/guutz/symbiont-cms.git: true
EOF

cd "$PROBE"

if ! pnpm install 2>&1 | tail -20; then
  echo
  echo "FAIL: pnpm install did not complete for #$TAG"
  exit 1
fi

echo
fail=0

check_file() {
  if [ -f "$PROBE/node_modules/symbiont-cms/$1" ]; then
    echo "  ok      $1"
  else
    echo "  MISSING $1"
    fail=1
  fi
}

echo "Build artifacts:"
check_file dist/index.js
check_file dist/index.d.ts
check_file dist/server.js
check_file dist/server.d.ts

echo
echo "Resolution:"
for entry in "symbiont-cms" "symbiont-cms/server"; do
  if node -e "
    import('$entry')
      .then(m => { console.log('  ok      import $entry (' + Object.keys(m).length + ' exports)'); })
      .catch(e => { console.log('  FAIL    import $entry -- ' + e.message.split('\n')[0]); process.exit(1); })
  " 2>/dev/null; then
    :
  else
    echo "  FAIL    import $entry"
    fail=1
  fi
done

echo
echo "API surface the Tech depends on:"
if node -e "
  import('symbiont-cms').then(m => {
    const client = m.createSymbiontClient;
    if (typeof client !== 'function') { console.log('  FAIL    createSymbiontClient missing'); process.exit(1); }
    const c = client({
      supabase: { url: 'https://example.supabase.co', publishableKey: 'x' },
      databases: [{ alias: 'a', dataSourceId: 'b' }]
    });
    if (typeof c.getSSRClient !== 'function') {
      console.log('  FAIL    getSSRClient missing -- the feed rewrite needs this');
      process.exit(1);
    }
    console.log('  ok      createSymbiontClient + getSSRClient');
  }).catch(e => { console.log('  FAIL    ' + e.message.split('\n')[0]); process.exit(1); });
" 2>/dev/null; then
  :
else
  echo "  FAIL    createSymbiontClient / getSSRClient probe"
  fail=1
fi

echo
if [ "$fail" -eq 0 ]; then
  echo "PASS: symbiont-cms#$TAG installs and imports cleanly."
else
  echo "FAIL: symbiont-cms#$TAG is not a usable release artifact."
  echo "Fix it in symbiont-cms before deploying. See the header of this script."
  exit 1
fi

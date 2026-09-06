#!/usr/bin/env bash
#
# Swap node_modules/symbiont-cms between the pinned git tag and a local checkout,
# without touching pnpm-lock.yaml or pnpm config.
#
#   pnpm run symbiont:link      # develop against ../../shenanigans/symbiont-cms
#   pnpm run symbiont:unlink    # restore the tagged install from the lockfile
#   pnpm run symbiont:status    # show which one is active
#
# WHY NOT `overrides:` / `pnpm link`?
#   Both write a `link:` dependency into pnpm's resolution graph, which rewrites
#   pnpm-lock.yaml. A lockfile in that state does not resolve on Vercel (the path
#   does not exist there), so the override had to stay gitignored -- and it kept
#   dragging the lockfile with it. Swapping the symlink by hand keeps the lockfile
#   permanently honest: the committed state is always the deploying state.
#
# CAVEAT: `pnpm install` recreates node_modules/symbiont-cms from the lockfile and
# silently undoes a link. Re-run `pnpm run symbiont:link` afterwards.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="$REPO_ROOT/node_modules/symbiont-cms"
LOCAL_SRC="${SYMBIONT_LOCAL_PATH:-$REPO_ROOT/../../shenanigans/symbiont-cms}"
BACKUP="$REPO_ROOT/node_modules/.symbiont-cms-tagged"

usage() { echo "usage: $0 {link|unlink|status}" >&2; exit 2; }

is_linked() { [ -L "$TARGET" ]; }

cmd_status() {
  if [ ! -e "$TARGET" ] && [ ! -L "$TARGET" ]; then
    echo "symbiont-cms: NOT INSTALLED (run pnpm install)"
    return 0
  fi
  if is_linked; then
    echo "symbiont-cms: LOCAL  -> $(readlink "$TARGET")"
    echo "  Remember to run 'pnpm run symbiont:unlink' before a release build."
  else
    local version
    version="$(node -p "require('$TARGET/package.json').version" 2>/dev/null || echo '?')"
    echo "symbiont-cms: TAGGED (v$version, from pnpm-lock.yaml)"
  fi
}

cmd_link() {
  if [ ! -d "$LOCAL_SRC" ]; then
    echo "error: local checkout not found at:" >&2
    echo "  $LOCAL_SRC" >&2
    echo "set SYMBIONT_LOCAL_PATH to override." >&2
    exit 1
  fi

  if is_linked; then
    echo "already linked -> $(readlink "$TARGET")"
    exit 0
  fi

  # Preserve the tagged install so unlink works without a full reinstall.
  if [ -e "$TARGET" ]; then
    rm -rf "$BACKUP"
    mv "$TARGET" "$BACKUP"
  fi

  ln -s "$(cd "$LOCAL_SRC" && pwd)" "$TARGET"
  echo "linked symbiont-cms -> $(readlink "$TARGET")"

  if [ ! -d "$LOCAL_SRC/node_modules" ]; then
    echo
    echo "warning: $LOCAL_SRC/node_modules is missing." >&2
    echo "Node resolves a symlinked package's deps from its real path, so run" >&2
    echo "'pnpm install' inside the symbiont-cms checkout too." >&2
  fi
}

cmd_unlink() {
  if ! is_linked; then
    echo "not linked; nothing to do"
    cmd_status
    exit 0
  fi

  rm "$TARGET"

  if [ -d "$BACKUP" ]; then
    mv "$BACKUP" "$TARGET"
    echo "restored tagged symbiont-cms from backup"
  else
    echo "no backup found -- run 'pnpm install' to restore the tagged version" >&2
  fi

  cmd_status
}

case "${1:-}" in
  link)   cmd_link ;;
  unlink) cmd_unlink ;;
  status) cmd_status ;;
  *)      usage ;;
esac

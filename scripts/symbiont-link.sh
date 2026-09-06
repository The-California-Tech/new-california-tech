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

# A plain `-L` test is NOT enough: pnpm's normal layout for a tagged git
# dependency is ALSO a symlink, pointing into node_modules/.pnpm/. Treating that
# as a dev link made `symbiont:status` report LOCAL for an ordinary tagged
# install, and made `symbiont:link` refuse to do anything ("already linked").
# A real dev link resolves OUTSIDE this project's node_modules.
is_linked() {
  [ -L "$TARGET" ] || return 1
  local resolved
  resolved="$(cd "$(dirname "$TARGET")" && cd "$(readlink "$TARGET")" 2>/dev/null && pwd)" || return 1
  case "$resolved" in
    "$REPO_ROOT"/node_modules/*) return 1 ;;  # pnpm store link => tagged install
    *) return 0 ;;                            # outside the project => dev link
  esac
}

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
    cmd_status
    return 0
  fi

  # No backup: the link predates this script (pnpm's `overrides` used to create
  # it). A plain `pnpm install` will NOT restore the package -- pnpm compares the
  # lockfile, sees nothing to change, and reports "Already up to date" while
  # node_modules/symbiont-cms stays missing. --force is what actually refetches.
  echo "no backup found (link predates this script)." >&2
  echo "Restoring from the lockfile with 'pnpm install --force'..." >&2
  if (cd "$REPO_ROOT" && pnpm install --force); then
    cmd_status
  else
    echo >&2
    echo "pnpm install --force failed. If it failed while *preparing* the git" >&2
    echo "dependency, the tag itself is broken -- run:" >&2
    echo "    pnpm run symbiont:verify-tag" >&2
    exit 1
  fi
}

case "${1:-}" in
  link)   cmd_link ;;
  unlink) cmd_unlink ;;
  status) cmd_status ;;
  *)      usage ;;
esac

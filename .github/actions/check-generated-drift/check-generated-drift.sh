#!/usr/bin/env bash
set -euo pipefail

readonly EXIT_OK=0
readonly EXIT_DRIFT=1
readonly EXIT_MISSING_PNPM=2

_require_pnpm() {
  if ! command -v pnpm >/dev/null 2>&1; then
    echo "error: pnpm is required" >&2
    exit "$EXIT_MISSING_PNPM"
  fi
}

main() {
  local pnpm_script="${PNPM_SCRIPT:-api:types}"

  _require_pnpm

  pnpm "$pnpm_script"

  if ! git diff --quiet; then
    echo "Drifted files:" >&2
    git diff --name-only >&2
    echo "" >&2
    echo "error: generated files are out of sync" >&2
    echo "Run 'pnpm ${pnpm_script}' locally and commit the result." >&2
    exit "$EXIT_DRIFT"
  fi

  exit "$EXIT_OK"
}

main "$@"

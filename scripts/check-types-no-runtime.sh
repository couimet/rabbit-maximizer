#!/bin/bash
# Check that files in **/types/** directories only contain pure TypeScript types.
# Runtime exports (enum, const, class, function, etc.) are prohibited in types/
# because those directories are excluded from code coverage.

set -euo pipefail

search_dirs=""
[ -d src ] && search_dirs="$search_dirs src"
[ -d tests ] && search_dirs="$search_dirs tests"

if [ -z "$search_dirs" ]; then
  echo "No types/ files found."
  exit 0
fi

# Runtime export patterns prohibited in types/ directories:
#   export enum|const|class|function|let|var|default|abstract class
#   export { Symbol } (bare re-export without type qualifier)
# We intentionally do NOT match:
#   export interface   (pure type)
#   export type        (pure type alias)
#   export type {      (type-only re-export)
#   export { type      (inline type re-export)
decl_pattern='^[[:space:]]*export[[:space:]]+(enum|const|class|function|let|var|default|abstract[[:space:]]+class)'
reexport_pattern='^[[:space:]]*export[[:space:]]+\{'

run_scan() {
  local pattern="$1"
  local label="$2"

  local stderr_file
  stderr_file=$(mktemp)

  local result
  # $search_dirs intentionally word-split into multiple directory args
  # shellcheck disable=SC2086
  result=$(find $search_dirs -path '*/types/*.ts' -type f -exec grep -nE "$pattern" {} + 2>"$stderr_file")
  local grep_rc=$?

  local stderr_content
  stderr_content=$(cat "$stderr_file")
  rm -f "$stderr_file"

  if [ -n "$stderr_content" ]; then
    echo "ERROR: ${label} scan failed:" >&2
    echo "${stderr_content}" >&2
    exit 1
  fi

  if [ "$grep_rc" -gt 1 ]; then
    echo "ERROR: ${label} grep failed with exit code ${grep_rc}" >&2
    exit 1
  fi

  # grep_rc=0: matches found; grep_rc=1: no matches
  if [ -n "$result" ]; then
    echo "$result"
  fi
}

violations=""

# Phase 1: Declaration forms (export enum, export const, etc.)
decl_violations=$(run_scan "$decl_pattern" "declaration")
if [ -n "$decl_violations" ]; then
  violations="${decl_violations}"
fi

# Phase 2: Re-export forms (export { Symbol })
# Filter out type-only: export type { and export { type
raw_reexports=$(run_scan "$reexport_pattern" "re-export")
if [ -n "$raw_reexports" ]; then
  filter_stderr=$(mktemp)
  set +eo pipefail
  filtered=$(echo "$raw_reexports" | grep -vE 'export[[:space:]]+type[[:space:]]*\{|export[[:space:]]*\{[[:space:]]*type[[:space:],]' 2>"$filter_stderr")
  filter_rc=$?
  set -eo pipefail
  filter_stderr_content=$(cat "$filter_stderr")
  rm -f "$filter_stderr"

  if [ -n "$filter_stderr_content" ] || [ "$filter_rc" -gt 1 ]; then
    echo "ERROR: Re-export filter failed" >&2
    [ -n "$filter_stderr_content" ] && echo "${filter_stderr_content}" >&2
    exit 1
  fi

  # filter_rc=0: runtime re-exports found; filter_rc=1: all type-only (no violation)
  if [ -n "$filtered" ]; then
    if [ -n "$violations" ]; then
      violations="${violations}"$'\n'"${filtered}"
    else
      violations="${filtered}"
    fi
  fi
fi

if [ -n "$violations" ]; then
  echo "ERROR: Runtime exports found in types/ directories."
  echo "These directories are excluded from code coverage and may only contain"
  echo "export interface and export type declarations."
  echo ""
  echo "$violations"
  echo ""
  echo "Move enums, consts, classes, functions, and other runtime values"
  echo "to a non-types/ directory."
  exit 1
fi

# Count files for the success message
count_stderr=$(mktemp)
set +o pipefail
# $search_dirs intentionally word-split into multiple directory args
# shellcheck disable=SC2086
count=$(find $search_dirs -path '*/types/*.ts' -type f 2>"$count_stderr" | wc -l | tr -d ' ')
set -o pipefail
count_stderr_content=$(cat "$count_stderr")
rm -f "$count_stderr"

if [ -n "$count_stderr_content" ]; then
  echo "ERROR: File count scan failed:" >&2
  echo "${count_stderr_content}" >&2
  exit 1
fi

if [ "$count" -eq 0 ]; then
  echo "No types/ files found."
else
  echo "OK: No runtime exports in types/ directories (${count} files checked)."
fi

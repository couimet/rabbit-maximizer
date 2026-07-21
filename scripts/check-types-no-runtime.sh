#!/bin/bash
# Check that files in **/types/** directories only contain pure TypeScript types.
# Runtime exports (enum, const, class, function, etc.) are prohibited in types/
# because those directories are excluded from code coverage.

set -euo pipefail

# Runtime export patterns prohibited in types/ directories:
#   export enum|const|class|function|let|var|default|abstract class
# We intentionally do NOT match:
#   export interface  (pure type)
#   export type       (pure type alias)
#   export type {     (type-only re-export)
#   export { type     (inline type re-export)
pattern='^[[:space:]]*export[[:space:]]+(enum|const|class|function|let|var|default|abstract[[:space:]]+class)'

violations=$(find src tests -path '*/types/*.ts' -type f -exec grep -nE "$pattern" {} + 2>/dev/null) || true

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

count=$(find src tests -path '*/types/*.ts' -type f 2>/dev/null | wc -l | tr -d ' ') || true

if [ "$count" -eq 0 ]; then
  echo "No types/ files found."
else
  echo "OK: No runtime exports in types/ directories (${count} files checked)."
fi

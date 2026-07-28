#!/usr/bin/env bash
set -euo pipefail

# Validate that the generated Prisma client matches the tracked snapshot.
# Both files are formatted with prettier before comparison to match what CI
# does in ci:check-generated-drift.
#
# Exits 0 if they match, 1 if they differ (stale types), 2 on setup errors.
#
# Usage: prisma-validate.sh

TRACKED="prisma/generated/index.d.ts"

if [[ ! -f "$TRACKED" ]]; then
  echo "error: tracked snapshot not found at $TRACKED — run pnpm prisma:snapshot first" >&2
  exit 2
fi

if [[ -n "${PRISMA_VALIDATE_GENERATED:-}" ]]; then
  SOURCE="$PRISMA_VALIDATE_GENERATED"
else
  prisma generate

  SOURCE=$(node --input-type=module -e '
    import { dirname, join } from "node:path";
    import { createRequire } from "node:module";
    const require = createRequire(import.meta.url);
    const clientEntry = require.resolve("@prisma/client");
    process.stdout.write(join(dirname(clientEntry), "..", "..", ".prisma", "client", "index.d.ts"));
  ')
fi

if [[ ! -f "$SOURCE" ]]; then
  echo "error: generated client not found at $SOURCE" >&2
  exit 2
fi

# Copy both to temp files and format so the comparison is prettier-clean.
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

cp "$SOURCE" "$TMPDIR/generated.d.ts"
cp "$TRACKED" "$TMPDIR/tracked.d.ts"
pnpm exec prettier --write "$TMPDIR/generated.d.ts" "$TMPDIR/tracked.d.ts" > /dev/null

if ! diff -q "$TMPDIR/generated.d.ts" "$TMPDIR/tracked.d.ts" > /dev/null 2>&1; then
  echo "FAIL: Prisma generated types are out of date." >&2
  echo "      Run: pnpm prisma:snapshot" >&2
  diff "$TMPDIR/generated.d.ts" "$TMPDIR/tracked.d.ts" || true
  exit 1
fi

echo "PASS: Prisma generated types match the tracked snapshot."

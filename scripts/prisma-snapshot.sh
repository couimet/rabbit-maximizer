#!/usr/bin/env bash
set -euo pipefail

# Copy the generated Prisma client index.d.ts to a tracked directory so CI can
# detect drift between the committed snapshot and what the current schema produces.
#
# Usage: prisma-snapshot.sh [source-index.d.ts]
#   If a source path is provided, it is copied directly (useful for testing).
#   Otherwise the script resolves the path via @prisma/client in node_modules.

SNAPSHOT_DIR="prisma/generated"
SNAPSHOT_FILE="$SNAPSHOT_DIR/index.d.ts"

if [[ $# -ge 1 ]]; then
  SOURCE="$1"
else
  SOURCE=$(node --input-type=module -e '
    import { dirname, join } from "node:path";
    import { createRequire } from "node:module";
    const require = createRequire(import.meta.url);
    const clientEntry = require.resolve("@prisma/client");
    process.stdout.write(join(dirname(clientEntry), "..", "..", ".prisma", "client", "index.d.ts"));
  ')
fi

if [[ ! -f "$SOURCE" ]]; then
  echo "error: generated file not found at $SOURCE — run prisma generate first" >&2
  exit 1
fi

mkdir -p "$SNAPSHOT_DIR"
cp "$SOURCE" "$SNAPSHOT_FILE"
echo "Snapshot copied to $SNAPSHOT_FILE"

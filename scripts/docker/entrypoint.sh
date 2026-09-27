#!/usr/bin/env bash
# Apply pending Prisma migrations, then start the server as PID 1.
#
# src/main.ts runs no migration, so a container that starts against an empty
# data volume would serve nothing. Set SKIP_MIGRATIONS=true to start against the
# schema the volume already holds, which keeps a container running when a
# migration fails.
#
# Two guards below catch the mount mistakes that Docker hides. A data directory
# outside a mount holds state the next replacement discards, and a directory at
# the configuration path means the host file was missing.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PRISMA_BIN="$PROJECT_ROOT/node_modules/.bin/prisma"
APP_ENTRY="$PROJECT_ROOT/dist/src/main.js"

DATA_DIR="${RABBIT_MAXIMIZER_DATA_DIR:-$PROJECT_ROOT/data}"
ENV_FILE="$PROJECT_ROOT/.env"

if [ -d "$ENV_FILE" ]; then
  echo "entrypoint: $ENV_FILE is a directory, so the configuration never arrived. Docker creates a directory when a bind mount source is missing on the host. Create the file, then start the container again." >&2
fi

if [ -d "$DATA_DIR" ]; then
  if ! command -v mountpoint >/dev/null 2>&1; then
    echo "entrypoint: mountpoint is unavailable, so the check on $DATA_DIR is skipped"
  elif ! mountpoint -q "$DATA_DIR"; then
    echo "entrypoint: $DATA_DIR is not a mount. Pass -v rabbit-maximizer-data:$DATA_DIR, or the database lands in the container layer and the next replacement discards it." >&2
    exit 1
  fi
fi

mkdir -p "$DATA_DIR"
cd "$PROJECT_ROOT"

if [ "${SKIP_MIGRATIONS:-false}" = "true" ]; then
  echo "entrypoint: SKIP_MIGRATIONS=true, starting without applying migrations"
else
  echo "entrypoint: applying pending migrations"
  "$PRISMA_BIN" migrate deploy
fi

exec node "$APP_ENTRY"

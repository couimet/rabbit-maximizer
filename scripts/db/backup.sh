#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_DIR="$("$SCRIPT_DIR/data-dir.sh")"
DB_FILE="$DATA_DIR/rabbit-maximizer.db"
BACKUP_DIR="$DATA_DIR/backups"
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%S.%NZ)
BACKUP_FILE="$BACKUP_DIR/$TIMESTAMP.sql.gz"

if [ ! -f "$DB_FILE" ]; then
  echo "No database found at data/rabbit-maximizer.db" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

sqlite3 "$DB_FILE" .dump | gzip > "$BACKUP_FILE"

echo "$BACKUP_FILE"

# Rotate: keep only the 10 most recent backups (filenames are ISO timestamps, so lexical sort = chronological)
find "$BACKUP_DIR" -maxdepth 1 -name '*.sql.gz' -type f -print 2>/dev/null | sort -r | tail -n +11 | while IFS= read -r f; do rm -f "$f" 2>/dev/null; done || true

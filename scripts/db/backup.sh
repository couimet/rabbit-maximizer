#!/usr/bin/env bash
set -euo pipefail

DB_FILE="$PWD/data/rabbit-maximizer.db"
BACKUP_DIR="$PWD/data/backups"
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%S.%NZ)
BACKUP_FILE="$BACKUP_DIR/$TIMESTAMP.sql.gz"

if [ ! -f "$DB_FILE" ]; then
  echo "No database found at data/rabbit-maximizer.db" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

sqlite3 "$DB_FILE" .dump | gzip > "$BACKUP_FILE"

echo "$BACKUP_FILE"

# Rotate: keep only the 10 most recent backups
ls -t "$BACKUP_DIR"/*.sql.gz 2>/dev/null | tail -n +11 | xargs rm -f 2>/dev/null || true

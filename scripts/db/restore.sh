#!/usr/bin/env bash
set -euo pipefail

DB_FILE="$PWD/data/rabbit-maximizer.db"
BACKUP_DIR="$PWD/data/backups"

if [ $# -eq 0 ]; then
  if [ ! -d "$BACKUP_DIR" ] || [ -z "$(ls -A "$BACKUP_DIR" 2>/dev/null)" ]; then
    echo "No backups found in data/backups/"
    exit 0
  fi
  echo "Available backups:"
  ls -lh "$BACKUP_DIR" | tail -n +2
  exit 0
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

echo -n "About to replace data/rabbit-maximizer.db with $BACKUP_FILE. Continue? [y/N] " >&2
read -r CONFIRM

if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
  echo "Aborted."
  exit 0
fi

# Pre-restore safety backup
if [ -f "$DB_FILE" ]; then
  TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  SAFETY_BACKUP="$BACKUP_DIR/$TIMESTAMP-pre-restore.sql.gz"
  mkdir -p "$BACKUP_DIR"
  sqlite3 "$DB_FILE" .dump | gzip > "$SAFETY_BACKUP"
  echo "Pre-restore backup: $SAFETY_BACKUP"
fi

# Restore into a fresh database (replace, don't merge)
rm -f "$DB_FILE"
if [[ "$BACKUP_FILE" == *.gz ]]; then
  gunzip -c "$BACKUP_FILE" | sqlite3 "$DB_FILE"
else
  sqlite3 "$DB_FILE" < "$BACKUP_FILE"
fi

echo "Restored data/rabbit-maximizer.db from $BACKUP_FILE"

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
  TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%S.%NZ)
  SAFETY_BACKUP="$BACKUP_DIR/$TIMESTAMP-pre-restore.sql.gz"
  mkdir -p "$BACKUP_DIR"
  sqlite3 "$DB_FILE" .dump | gzip > "$SAFETY_BACKUP"
  echo "Pre-restore backup: $SAFETY_BACKUP"
fi

# Restore to a temp file first, validate, then replace
TEMP_DB="$DB_FILE.$$.restoring"
rm -f "$TEMP_DB"
if [[ "$BACKUP_FILE" == *.gz ]]; then
  gunzip -c "$BACKUP_FILE" | sqlite3 "$TEMP_DB"
else
  sqlite3 "$TEMP_DB" < "$BACKUP_FILE"
fi

if ! sqlite3 "$TEMP_DB" ".tables" > /dev/null 2>&1; then
  echo "Restore failed: backup is not a valid SQLite database" >&2
  rm -f "$TEMP_DB"
  exit 1
fi

mv -f "$TEMP_DB" "$DB_FILE"

echo "Restored data/rabbit-maximizer.db from $BACKUP_FILE"

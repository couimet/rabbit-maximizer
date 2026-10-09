#!/usr/bin/env bash
# Write the local database into the archive that 'docker:move-data:import'
# accepts, so an operator can start a container on another host with the data
# from this machine. The archive holds the database file at its root, which is
# the shape a volume export produces.
#
# The copy comes from the SQLite backup API, so the local process may keep
# writing while it runs.
#
# Usage: pack.sh <file>
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_DIR="$("$SCRIPT_DIR/data-dir.sh")"
DB_FILE_NAME='rabbit-maximizer.db'
DB_FILE="$DATA_DIR/$DB_FILE_NAME"

usage() {
  echo 'Usage: pack.sh <file>' >&2
  echo '  <file>   archive to write, for example rabbit-maximizer-data.tar.gz' >&2
}

if [ $# -ne 1 ]; then
  usage
  exit 1
fi

ARCHIVE="$1"
ARCHIVE_DIR="$(dirname "$ARCHIVE")"

if [ ! -f "$DB_FILE" ]; then
  echo "No database found at $DB_FILE" >&2
  exit 1
fi

if [ ! -d "$ARCHIVE_DIR" ]; then
  echo "Directory not found: $ARCHIVE_DIR" >&2
  exit 1
fi

STAGING_DIR="$(mktemp -d)"
trap 'rm -rf "$STAGING_DIR"' EXIT

sqlite3 "$DB_FILE" ".backup '$STAGING_DIR/$DB_FILE_NAME'"
tar czf "$ARCHIVE" -C "$STAGING_DIR" "$DB_FILE_NAME"

if ! grep -qx "$DB_FILE_NAME" <<< "$(tar tzf "$ARCHIVE")"; then
  echo "The archive does not hold $DB_FILE_NAME" >&2
  exit 1
fi

echo "Wrote the local database to $ARCHIVE"

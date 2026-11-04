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

# tar opens its destination with O_TRUNC, so a path that names the live database
# would empty that database after the backup step copied it.
if [ -e "$ARCHIVE" ] && [ "$ARCHIVE" -ef "$DB_FILE" ]; then
  echo "The archive path names the live database: $ARCHIVE" >&2
  exit 1
fi

# The archive holds a copy of the database, so only the owner may read it. tar
# writes to a temporary file in the destination directory, so a failed run leaves
# no partial archive under the final name.
umask 077
STAGING_DIR="$(mktemp -d)"
ARCHIVE_TMP="$(mktemp "$ARCHIVE_DIR/.pack.XXXXXX")"
trap 'rm -rf "$STAGING_DIR" "$ARCHIVE_TMP"' EXIT

sqlite3 "$DB_FILE" ".backup '$STAGING_DIR/$DB_FILE_NAME'"
tar czf "$ARCHIVE_TMP" -C "$STAGING_DIR" "$DB_FILE_NAME"
mv -f "$ARCHIVE_TMP" "$ARCHIVE"

if ! grep -qx "$DB_FILE_NAME" <<< "$(tar tzf "$ARCHIVE")"; then
  echo "The archive does not hold $DB_FILE_NAME" >&2
  exit 1
fi

echo "Wrote the local database to $ARCHIVE"

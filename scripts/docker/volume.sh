#!/bin/sh
# Write the data directory into an archive, or restore it from one. This script
# runs inside a container, against the mounts the caller provides: the data
# directory and the directory that holds the archive.
#
# The image carries a copy, so an operator without a clone of the repository
# runs the restore for a volume by naming the image they already pulled. The
# image runs this script as root, which the owner fixup below needs.
#
# Usage: volume.sh export <archive>
#        volume.sh import <archive>
#
# The import stages the payload inside the data directory and checks it for the
# database before it moves the current contents aside. A wrong name, an
# unreadable archive, or an archive of another volume therefore leaves the
# database in place, and the staging directory never survives the run. Every
# move stays on one filesystem, so no step needs free space.
#
# One window stays open: a failure between the two moves leaves the current
# contents in the previous directory instead of the data directory. The next run
# clears both, so recover by hand if the restore must not run again.
#
# POSIX sh, because the container that runs this may be alpine or Debian.
#
# Environment:
#   RABBIT_MAXIMIZER_DATA_DIR   the data directory, default /data
set -eu

DATA_DIR="${RABBIT_MAXIMIZER_DATA_DIR:-/data}"
DB_FILE_NAME='rabbit-maximizer.db'
STAGING_DIR_NAME='.restore'
PREVIOUS_DIR_NAME='.previous'
DATA_UID='1001'
DATA_GID='1001'

STAGING_DIR="$DATA_DIR/$STAGING_DIR_NAME"
PREVIOUS_DIR="$DATA_DIR/$PREVIOUS_DIR_NAME"

usage() {
  echo 'Usage: volume.sh export <archive>' >&2
  echo '       volume.sh import <archive>' >&2
}

if [ "$#" -ne 2 ]; then
  usage
  exit 1
fi

COMMAND="$1"
ARCHIVE="$2"

case "$COMMAND" in
  export | import) ;;
  *)
    echo "Unknown subcommand '$COMMAND'" >&2
    usage
    exit 1
    ;;
esac

if [ ! -d "$DATA_DIR" ]; then
  echo "Data directory not found: $DATA_DIR" >&2
  exit 1
fi

if [ "$COMMAND" = 'export' ]; then
  # An archive must not carry the staging directories a failed import left.
  if ! tar czf "$ARCHIVE" -C "$DATA_DIR" \
    --exclude="./$STAGING_DIR_NAME" \
    --exclude="./$PREVIOUS_DIR_NAME" .; then
    echo "Could not write $ARCHIVE" >&2
    exit 1
  fi

  echo "Wrote $DATA_DIR to $ARCHIVE"
  exit 0
fi

if [ ! -f "$ARCHIVE" ]; then
  echo "Archive not found: $ARCHIVE" >&2
  exit 1
fi

# A failed restore must leave the data directory as it was, so no run leaves its
# own staging directory behind. The previous directory is deliberately not
# removed here: a failure between the two moves is the one case where it holds
# the only copy of the database.
trap 'rm -rf "$STAGING_DIR"' EXIT

rm -rf "$STAGING_DIR" "$PREVIOUS_DIR"
mkdir -p "$STAGING_DIR"

if ! tar xzf "$ARCHIVE" -C "$STAGING_DIR"; then
  echo "The archive did not open: $ARCHIVE. $DATA_DIR keeps its contents." >&2
  exit 1
fi

if [ ! -f "$STAGING_DIR/$DB_FILE_NAME" ]; then
  echo "The archive holds no $DB_FILE_NAME. $DATA_DIR keeps its contents." >&2
  exit 1
fi

mkdir -p "$PREVIOUS_DIR"
find "$DATA_DIR" -mindepth 1 -maxdepth 1 \
  ! -name "$STAGING_DIR_NAME" ! -name "$PREVIOUS_DIR_NAME" \
  -exec mv {} "$PREVIOUS_DIR/" \;
find "$STAGING_DIR" -mindepth 1 -maxdepth 1 -exec mv {} "$DATA_DIR/" \;
rm -rf "$PREVIOUS_DIR" "$STAGING_DIR"

# The caller runs this as root, so the extracted files arrive owned by root.
# The application runs as uid 1001, and SQLite refuses to write a file that
# another user owns. A caller that already runs as uid 1001 owns the files
# already, and its refused chown is not an error.
chown -R "$DATA_UID:$DATA_GID" "$DATA_DIR" 2>/dev/null || true

echo "Restored $DATA_DIR from $ARCHIVE"

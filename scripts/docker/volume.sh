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
# database before it moves the current contents aside. A member that is a link
# or that points outside the staging directory, a wrong name, an unreadable
# archive, an archive of another volume, or a payload that is not a SQLite
# database therefore leaves the database in place, and the staging directory
# never survives the run. Every move stays on one filesystem, so no step needs
# free space.
#
# One window stays open: a failure between the two moves leaves the current
# contents in the previous directory instead of the data directory. The import
# then refuses to run, because that directory can hold the only copy of the
# database. Its message names the recovery.
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
LOCK_FILE_NAME='.import-lock'
SQLITE_HEADER='SQLite format 3'
SQLITE_HEADER_LENGTH=15
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
  # A failed import can leave the only database in the previous directory. The
  # export skips that directory, so it would report success on an archive that
  # holds no database.
  if [ -d "$PREVIOUS_DIR" ]; then
    echo "An earlier import stopped between its two moves, so the previous contents of $DATA_DIR are in $PREVIOUS_DIR." >&2
    echo "Recover that directory before you export; the export does not carry it." >&2
    exit 1
  fi

  if [ ! -f "$DATA_DIR/$DB_FILE_NAME" ]; then
    echo "No $DB_FILE_NAME in $DATA_DIR, so there is nothing to export." >&2
    exit 1
  fi

  # The archive holds a copy of the database, so only the owner may read it. The
  # write goes to a temporary file, so a failed run leaves no partial archive.
  umask 077
  ARCHIVE_TMP="$ARCHIVE.tmp.$$"

  if ! tar czf "$ARCHIVE_TMP" -C "$DATA_DIR" \
    --exclude="./$STAGING_DIR_NAME" \
    --exclude="./$PREVIOUS_DIR_NAME" \
    --exclude="./$LOCK_FILE_NAME" .; then
    rm -f "$ARCHIVE_TMP"
    echo "Could not write $ARCHIVE" >&2
    exit 1
  fi

  if ! mv -f "$ARCHIVE_TMP" "$ARCHIVE"; then
    rm -f "$ARCHIVE_TMP"
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

# An earlier import that stopped between its two moves left the current contents
# in the previous directory. That directory can hold the only copy of the
# database, so no run removes it. A person recovers it by hand.
if [ -d "$PREVIOUS_DIR" ]; then
  echo "An earlier import stopped between its two moves, so the previous data of $DATA_DIR is in $PREVIOUS_DIR, and $DATA_DIR can hold part of the new payload." >&2
  echo "Move the entries that the failed import added out of $DATA_DIR, move the entries of $PREVIOUS_DIR back into $DATA_DIR, remove $PREVIOUS_DIR, and run the import again." >&2
  exit 1
fi

# Two imports against one volume would interleave their staging directories and
# their moves. The kernel drops this lock when the process ends, so a killed run
# never blocks the next one.
if ! command -v flock > /dev/null 2>&1; then
  echo 'The flock command is unavailable, so the import cannot hold its lock.' >&2
  exit 1
fi

LOCK_FILE="$DATA_DIR/$LOCK_FILE_NAME"
exec 9>"$LOCK_FILE"

if ! flock -n 9; then
  echo "Another import holds the lock on $DATA_DIR. Wait for that run to finish." >&2
  exit 1
fi

# A failed restore must leave the data directory as it was, so no run leaves its
# own staging directory behind.
trap 'rm -rf "$STAGING_DIR"' EXIT

# The extractor must never write outside the staging directory. Both tar
# versions in use refuse that today, but the refusal belongs to the version and
# not to the archive format, and a base image change can drop it. A data volume
# holds files and directories only, so the listing is the guard.
UNSAFE_NAME="$(tar tzf "$ARCHIVE" 2>/dev/null | grep -E '^/|(^|/)\.\.(/|$)' | head -n 1)"

if [ -n "$UNSAFE_NAME" ]; then
  echo "The archive holds a member that points outside the staging directory: $UNSAFE_NAME. $DATA_DIR keeps its contents." >&2
  exit 1
fi

# The staging and previous directories belong to this script. A member of either
# name would land on a live directory during the second move.
RESERVED_MEMBER="$(tar tzf "$ARCHIVE" 2>/dev/null | sed 's|^\./||' | grep -E "^($STAGING_DIR_NAME|$PREVIOUS_DIR_NAME)(/|$)" | head -n 1)"

if [ -n "$RESERVED_MEMBER" ]; then
  echo "The archive holds the reserved member $RESERVED_MEMBER. $DATA_DIR keeps its contents." >&2
  exit 1
fi

# A later member lands where an earlier link points, so a link would write into
# the data directory before the checks below run. The type is the first column
# of the verbose listing in both tar versions.
UNSAFE_MEMBER="$(tar tvzf "$ARCHIVE" 2>/dev/null | grep -Ev '^[-d]' | head -n 1)"

if [ -n "$UNSAFE_MEMBER" ]; then
  echo "The archive holds a member that is not a file or a directory: $UNSAFE_MEMBER. $DATA_DIR keeps its contents." >&2
  exit 1
fi

rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR"

if ! tar xzf "$ARCHIVE" -C "$STAGING_DIR"; then
  echo "The archive did not open: $ARCHIVE. $DATA_DIR keeps its contents." >&2
  exit 1
fi

if [ ! -f "$STAGING_DIR/$DB_FILE_NAME" ]; then
  echo "The archive holds no $DB_FILE_NAME. $DATA_DIR keeps its contents." >&2
  exit 1
fi

# Every SQLite database starts with the same 15 bytes. The image carries no
# sqlite3 client, so the header is the whole proof that the payload is a
# database rather than a file of that name.
STAGED_HEADER="$(dd if="$STAGING_DIR/$DB_FILE_NAME" bs=1 count="$SQLITE_HEADER_LENGTH" 2>/dev/null)"

if [ "$STAGED_HEADER" != "$SQLITE_HEADER" ]; then
  echo "The archive holds a $DB_FILE_NAME that is not a SQLite database. $DATA_DIR keeps its contents." >&2
  exit 1
fi

# Moves every entry of a directory into another directory. A find -exec
# predicate reports a failed move as a false result and still exits 0, so the
# script runs each move itself and stops the import on the first failure.
move_entries() {
  source_dir="$1"
  destination_dir="$2"
  skip_names="$3"

  for entry in "$source_dir"/* "$source_dir"/.[!.]* "$source_dir"/..?*; do
    if [ ! -e "$entry" ] && [ ! -L "$entry" ]; then
      continue
    fi

    case " $skip_names " in
      *" ${entry##*/} "*) continue ;;
    esac

    if ! mv "$entry" "$destination_dir/"; then
      echo "Could not move $entry to $destination_dir. The import stopped, and $PREVIOUS_DIR keeps every entry it moved." >&2
      exit 1
    fi
  done
}

# The caller runs this as root, so the extracted files arrive owned by root. The
# application runs as uid 1001, and SQLite refuses to write a file that another
# user owns. The owner and the write bit are set before the first move, so a
# refused chown stops the import with the current data still in place. The data
# directory itself also belongs to uid 1001, because SQLite writes its journal
# beside the database.
chown -R "$DATA_UID:$DATA_GID" "$STAGING_DIR"
chmod -R u+rwX "$STAGING_DIR"
chown "$DATA_UID:$DATA_GID" "$DATA_DIR"
chmod u+rwx "$DATA_DIR"

mkdir -p "$PREVIOUS_DIR"
move_entries "$DATA_DIR" "$PREVIOUS_DIR" "$STAGING_DIR_NAME $PREVIOUS_DIR_NAME $LOCK_FILE_NAME"
move_entries "$STAGING_DIR" "$DATA_DIR" ''
rm -rf "$PREVIOUS_DIR" "$STAGING_DIR"

echo "Restored $DATA_DIR from $ARCHIVE"

#!/usr/bin/env bash
# Move the data volume between two hosts. 'export' writes the volume into a
# gzipped tar on the host; 'import' restores the volume from that tar.
#
# The archive work itself lives in volume.sh, which the image also carries. This
# script mounts that file into a small helper image, so a developer needs no
# build of the application image to move a volume.
#
# Usage: move-data.sh export <file>
#        move-data.sh import <file>
set -euo pipefail

VOLUME_NAME='rabbit-maximizer-data'
VOLUME_MOUNT='/data'
ARCHIVE_MOUNT='/backup'
DB_FILE_NAME='rabbit-maximizer.db'
HELPER_IMAGE='alpine:3.24'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HELPER_SCRIPT="$SCRIPT_DIR/volume.sh"

usage() {
  echo 'Usage: move-data.sh export <file>' >&2
  echo '       move-data.sh import <file>' >&2
}

# Compose names a container after its project, and a plain 'docker run' lets the
# operator pick any name. The volume is the identity that both forms share.
running_containers() {
  local ids
  ids="$(docker ps --filter "volume=$VOLUME_NAME" --format '{{.ID}}')" || return 1
  # An empty list must stay empty: printf over no line still prints one space.
  if [ -n "$ids" ]; then
    printf '%s\n' "$ids" | tr '\n' ' ' | sed 's/ $//'
  fi
}

refuse_running_container() {
  local ids

  if ! ids="$(running_containers)"; then
    echo "The check for a container on the $VOLUME_NAME volume failed. Stop any container that uses the volume, then run the command again." >&2
    exit 1
  fi

  if [ -n "$ids" ]; then
    echo "A container mounts the $VOLUME_NAME volume: $ids" >&2
    echo "Stop it first with 'docker stop $ids', or with 'docker compose stop rabbit-maximizer' for a Compose deployment." >&2
    exit 1
  fi
}

# The file test answers 0 for a held database and 1 for an empty volume. Any
# other status comes from docker itself and says nothing about the volume, so
# the caller must not read it as an empty volume.
volume_holds_database() {
  local status=0

  docker run --rm --volume "$VOLUME_NAME:$VOLUME_MOUNT:ro" "$HELPER_IMAGE" \
    test -f "$VOLUME_MOUNT/$DB_FILE_NAME" || status=$?

  case "$status" in
    0 | 1) return "$status" ;;
  esac

  echo "The probe of the $VOLUME_NAME volume failed, and docker exited with status $status." >&2
  exit 1
}

# The helper runs as root for two reasons: the archive directory on the host
# belongs to the caller's account and not to the helper image, and the import
# sets the owner of the data directory to uid 1001 afterwards.
run_helper() {
  local mount_mode="$1"
  shift
  docker run --rm --user root \
    --volume "$VOLUME_NAME:$VOLUME_MOUNT:$mount_mode" \
    --volume "$ARCHIVE_DIR:$ARCHIVE_MOUNT" \
    --volume "$HELPER_SCRIPT:$HELPER_SCRIPT:ro" \
    "$HELPER_IMAGE" \
    sh "$HELPER_SCRIPT" "$@"
}

write_archive() {
  run_helper ro export "$ARCHIVE_MOUNT/$(basename "$1")"
}

if [ $# -ne 2 ]; then
  usage
  exit 1
fi

COMMAND="$1"
ARCHIVE="$2"

case "$COMMAND" in
  export|import) ;;
  *)
    echo "Unknown subcommand '$COMMAND'" >&2
    usage
    exit 1
    ;;
esac

if [ -z "$ARCHIVE" ]; then
  usage
  exit 1
fi

if [ ! -d "$(dirname "$ARCHIVE")" ]; then
  echo "Directory not found: $(dirname "$ARCHIVE")" >&2
  exit 1
fi

ARCHIVE_DIR="$(cd "$(dirname "$ARCHIVE")" && pwd)"
ARCHIVE_NAME="$(basename "$ARCHIVE")"

if [ "$COMMAND" = 'export' ]; then
  refuse_running_container
  write_archive "$ARCHIVE_DIR/$ARCHIVE_NAME"
  echo "Wrote the $VOLUME_NAME volume to $ARCHIVE_DIR/$ARCHIVE_NAME"
  exit 0
fi

if [ ! -f "$ARCHIVE_DIR/$ARCHIVE_NAME" ]; then
  echo "Archive not found: $ARCHIVE_DIR/$ARCHIVE_NAME" >&2
  exit 1
fi

refuse_running_container

if volume_holds_database; then
  # The name carries one-second precision, so a second run in the same second
  # would replace the backup of the first.
  SAFETY_ARCHIVE="$ARCHIVE_DIR/pre-import-$(date -u +%Y%m%dT%H%M%SZ).tar.gz"

  if [ -e "$SAFETY_ARCHIVE" ]; then
    echo "Safety export already exists: $SAFETY_ARCHIVE" >&2
    exit 1
  fi

  echo -n "About to replace the database in the $VOLUME_NAME volume. Continue? [y/N] " >&2
  read -r CONFIRM || CONFIRM=''

  if [ "$CONFIRM" != 'y' ] && [ "$CONFIRM" != 'Y' ]; then
    echo 'Aborted.'
    exit 0
  fi

  write_archive "$SAFETY_ARCHIVE"
  echo "Safety export: $SAFETY_ARCHIVE"
fi

if ! run_helper rw import "$ARCHIVE_MOUNT/$ARCHIVE_NAME"; then
  echo "The archive did not restore: $ARCHIVE_DIR/$ARCHIVE_NAME. The helper's message names the reason." >&2
  echo "Check the $VOLUME_NAME volume before you start the container again. A failed move can leave the previous data in .previous inside the volume, and the helper's message names that recovery." >&2
  exit 1
fi

echo "Restored the $VOLUME_NAME volume from $ARCHIVE_DIR/$ARCHIVE_NAME"
echo "Start the container again with 'docker start <container>', or with 'docker compose start rabbit-maximizer'."

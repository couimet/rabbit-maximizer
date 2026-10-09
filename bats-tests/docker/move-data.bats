#!/usr/bin/env bats

load test_helper

# Docker is not available to a unit test, so the sandbox holds a fake docker.
# Mocking by path keeps test-only overrides out of the script.

SCRIPT="$SCRIPT_DIR/docker/move-data.sh"
VOLUME_NAME='rabbit-maximizer-data'
DB_FILE_NAME='rabbit-maximizer.db'
ARCHIVE_REF='/backup/rabbit-maximizer-data.tar.gz'
HELPER_SCRIPT="$SCRIPT_DIR/docker/volume.sh"
# The script delegates the archive work to the helper, so the command it builds
# is the whole contract this suite checks. The helper owns its own behavior.
EXPORT_COMMAND="sh $HELPER_SCRIPT export $ARCHIVE_REF"
IMPORT_COMMAND="sh $HELPER_SCRIPT import $ARCHIVE_REF"

setup() {
  CALL_LOG="$BATS_TEST_TMPDIR/calls.log"
  BIN_DIR="$BATS_TEST_TMPDIR/bin"
  ARCHIVE="$BATS_TEST_TMPDIR/rabbit-maximizer-data.tar.gz"
  export CALL_LOG

  mkdir -p "$BIN_DIR"
  cat > "$BIN_DIR/docker" <<'FAKE_DOCKER'
#!/usr/bin/env bash
echo "docker $*" >> "$CALL_LOG"

case "$1" in
  inspect)
    echo "${FAKE_CONTAINER_RUNNING:-false}"
    ;;
  run)
    # The read-only data mount plus a file test identifies the probe that asks
    # whether the volume holds a database. The export also mounts the volume
    # read-only, and its command never tests for a file.
    case "$*" in
      *'rabbit-maximizer-data:/data:ro'*'test -f'*)
        exit "${FAKE_VOLUME_HAS_DB:-1}"
        ;;
      *'volume.sh import'*)
        exit "${FAKE_RESTORE_FAILS:-0}"
        ;;
    esac
    ;;
esac
FAKE_DOCKER
  chmod +x "$BIN_DIR/docker"
  PATH="$BIN_DIR:$PATH"
  export PATH
}

move_data() {
  bash "$SCRIPT" "$@"
}

@test "exports the volume into a gzipped tar on the host" {
  run move_data export "$ARCHIVE"

  [ "$status" -eq 0 ]
  [[ "$(cat "$CALL_LOG")" == *"$EXPORT_COMMAND"* ]]
  [[ "$output" == *"Wrote the $VOLUME_NAME volume to $ARCHIVE"* ]]
}

@test "refuses to export while the container runs" {
  FAKE_CONTAINER_RUNNING='true' run move_data export "$ARCHIVE"

  [ "$status" -eq 1 ]
  [[ "$output" == *'Container rabbit-maximizer is running'* ]]
  [[ "$(cat "$CALL_LOG")" != *"$EXPORT_COMMAND"* ]]
}

@test "refuses to import while the container runs" {
  FAKE_CONTAINER_RUNNING='true' run move_data import "$ARCHIVE"

  [ "$status" -eq 1 ]
  [[ "$output" == *'Container rabbit-maximizer is running'* ]]
  [[ "$(cat "$CALL_LOG")" != *"$IMPORT_COMMAND"* ]]
}

@test "imports the archive into an empty volume through the helper" {
  touch "$ARCHIVE"

  run move_data import "$ARCHIVE"

  [ "$status" -eq 0 ]
  local calls
  calls="$(cat "$CALL_LOG")"
  [[ "$calls" == *"$IMPORT_COMMAND"* ]]
  [[ "$output" == *"Restored the $VOLUME_NAME volume from $ARCHIVE"* ]]
}

@test "runs the helper as root so it can set the owner of the data directory" {
  run move_data export "$ARCHIVE"

  [ "$status" -eq 0 ]
  [[ "$(cat "$CALL_LOG")" == *'docker run --rm --user root'* ]]
}

@test "reports an archive that holds no database" {
  touch "$ARCHIVE"

  FAKE_RESTORE_FAILS=1 run move_data import "$ARCHIVE"

  [ "$status" -eq 1 ]
  [[ "$output" == *"$ARCHIVE holds no $DB_FILE_NAME"* ]]
}

@test "refuses to overwrite a volume that already holds a database" {
  touch "$ARCHIVE"

  FAKE_VOLUME_HAS_DB=0 run bash -c "echo 'n' | bash '$SCRIPT' import '$ARCHIVE'"

  [ "$status" -eq 0 ]
  [[ "$output" == *'Aborted.'* ]]
  [[ "$(cat "$CALL_LOG")" != *"$IMPORT_COMMAND"* ]]
  [[ "$(cat "$CALL_LOG")" != *"$EXPORT_COMMAND"* ]]
}

@test "takes a safety export before it overwrites the volume" {
  touch "$ARCHIVE"

  FAKE_VOLUME_HAS_DB=0 run bash -c "echo 'y' | bash '$SCRIPT' import '$ARCHIVE'"

  [ "$status" -eq 0 ]
  local calls
  calls="$(cat "$CALL_LOG")"
  [[ "$calls" == *"sh $HELPER_SCRIPT export /backup/pre-import-"* ]]
  [[ "$calls" == *"$IMPORT_COMMAND"* ]]
  [[ "$output" == *'Safety export: '* ]]
}

@test "refuses an archive that does not exist" {
  run move_data import "$BATS_TEST_TMPDIR/missing.tar.gz"

  [ "$status" -eq 1 ]
  [[ "$output" == *'Archive not found: '* ]]
}

@test "refuses a file whose directory does not exist" {
  run move_data export "$BATS_TEST_TMPDIR/missing/archive.tar.gz"

  [ "$status" -eq 1 ]
  [[ "$output" == *'Directory not found: '* ]]
}

@test "prints the usage for an unknown subcommand" {
  run move_data copy "$ARCHIVE"

  [ "$status" -eq 1 ]
  [[ "$output" == *"Unknown subcommand 'copy'"* ]]
  [[ "$output" == *'Usage: move-data.sh export <file>'* ]]
}

@test "prints the usage when the file argument is missing" {
  run move_data export

  [ "$status" -eq 1 ]
  [[ "$output" == *'Usage: move-data.sh export <file>'* ]]
}

@test "prints the usage when no argument is given" {
  run move_data

  [ "$status" -eq 1 ]
  [[ "$output" == *'Usage: move-data.sh export <file>'* ]]
}

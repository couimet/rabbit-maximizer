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
# The safety export name carries the clock at run time, so the sandbox pins the
# clock to name the file that the guard checks.
SAFETY_TIMESTAMP='20260101T000000Z'

setup() {
  CALL_LOG="$BATS_TEST_TMPDIR/calls.log"
  BIN_DIR="$BATS_TEST_TMPDIR/bin"
  ARCHIVE="$BATS_TEST_TMPDIR/rabbit-maximizer-data.tar.gz"
  FAKE_SAFETY_TIMESTAMP="$SAFETY_TIMESTAMP"
  export CALL_LOG FAKE_SAFETY_TIMESTAMP

  mkdir -p "$BIN_DIR"
  cat > "$BIN_DIR/docker" <<'FAKE_DOCKER'
#!/usr/bin/env bash
echo "docker $*" >> "$CALL_LOG"

case "$1" in
  ps)
    if [ -n "${FAKE_RUNNING_IDS:-}" ]; then
      echo "$FAKE_RUNNING_IDS"
    fi
    exit "${FAKE_PS_EXIT:-0}"
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

  cat > "$BIN_DIR/date" <<'FAKE_DATE'
#!/usr/bin/env bash
if [ "$*" = '-u +%Y%m%dT%H%M%SZ' ]; then
  printf '%s\n' "$FAKE_SAFETY_TIMESTAMP"
  exit 0
fi
exec /bin/date "$@"
FAKE_DATE
  chmod +x "$BIN_DIR/date"

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

@test "refuses to export while a container mounts the volume" {
  FAKE_RUNNING_IDS='abc123' run move_data export "$ARCHIVE"

  [ "$status" -eq 1 ]
  [[ "$output" == *"A container mounts the $VOLUME_NAME volume: abc123"* ]]
  [[ "$(cat "$CALL_LOG")" == *"docker ps --filter volume=$VOLUME_NAME"* ]]
  [[ "$(cat "$CALL_LOG")" != *"$EXPORT_COMMAND"* ]]
}

@test "refuses to import while a container mounts the volume" {
  touch "$ARCHIVE"

  FAKE_RUNNING_IDS='abc123' run move_data import "$ARCHIVE"

  [ "$status" -eq 1 ]
  [[ "$output" == *"A container mounts the $VOLUME_NAME volume: abc123"* ]]
  [[ "$(cat "$CALL_LOG")" != *"$IMPORT_COMMAND"* ]]
}

@test "refuses when the container check fails" {
  FAKE_PS_EXIT=1 run move_data export "$ARCHIVE"

  [ "$status" -eq 1 ]
  [[ "$output" == *"The check for a container on the $VOLUME_NAME volume failed"* ]]
  [[ "$(cat "$CALL_LOG")" != *"$EXPORT_COMMAND"* ]]
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

@test "reports the restore the helper refused and names the helper's message" {
  touch "$ARCHIVE"

  FAKE_RESTORE_FAILS=1 run move_data import "$ARCHIVE"

  [ "$status" -eq 1 ]
  [[ "$output" == *"The archive did not restore: $ARCHIVE."* ]]
  [[ "$output" == *"The helper's message names the reason."* ]]
  [[ "$output" != *'keeps its contents'* ]]
}

@test "refuses an import when the volume probe fails at the docker level" {
  touch "$ARCHIVE"

  FAKE_VOLUME_HAS_DB=125 run move_data import "$ARCHIVE"

  [ "$status" -eq 1 ]
  [[ "$output" == *"The probe of the $VOLUME_NAME volume failed"* ]]
  [[ "$output" == *'docker exited with status 125'* ]]
  [[ "$(cat "$CALL_LOG")" != *"$IMPORT_COMMAND"* ]]
  [[ "$(cat "$CALL_LOG")" != *"$EXPORT_COMMAND"* ]]
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

@test "refuses a safety export whose file already exists" {
  touch "$ARCHIVE"
  touch "$BATS_TEST_TMPDIR/pre-import-$SAFETY_TIMESTAMP.tar.gz"

  FAKE_VOLUME_HAS_DB=0 run bash -c "echo 'y' | bash '$SCRIPT' import '$ARCHIVE'"

  [ "$status" -eq 1 ]
  [[ "$output" == *'Safety export already exists: '* ]]
  [[ "$output" == *"pre-import-$SAFETY_TIMESTAMP.tar.gz"* ]]
  [[ "$(cat "$CALL_LOG")" != *'/backup/pre-import-'* ]]
  [[ "$(cat "$CALL_LOG")" != *"$IMPORT_COMMAND"* ]]
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

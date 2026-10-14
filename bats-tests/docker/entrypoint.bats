#!/usr/bin/env bats

load test_helper

# The entrypoint derives its project root from its own location, so each test
# builds a sandbox that holds a copy of the script, a fake prisma binary, and a
# fake app entry. Mocking by path keeps test-only overrides out of the script.
# The fake mountpoint does the same for the mount check, which reads a real
# mount table that no sandbox directory sits on.

APP_MARKER='app started'
MIGRATE_MARKER='prisma migrate deploy'

setup() {
  SANDBOX="$BATS_TEST_TMPDIR/app"
  CALL_LOG="$BATS_TEST_TMPDIR/calls.log"
  ENTRYPOINT="$SANDBOX/scripts/docker/entrypoint.sh"
  MOUNT_BIN="$BATS_TEST_TMPDIR/bin"
  export CALL_LOG ENTRYPOINT

  mkdir -p "$SANDBOX/scripts/docker" "$SANDBOX/node_modules/.bin" "$SANDBOX/dist/src" "$MOUNT_BIN"
  cp "$SCRIPT_DIR/docker/entrypoint.sh" "$ENTRYPOINT"
  chmod +x "$ENTRYPOINT"

  cat > "$SANDBOX/node_modules/.bin/prisma" <<'FAKE_PRISMA'
#!/usr/bin/env bash
echo "prisma $*" >> "$CALL_LOG"
exit "${FAKE_PRISMA_EXIT:-0}"
FAKE_PRISMA
  chmod +x "$SANDBOX/node_modules/.bin/prisma"

  cat > "$SANDBOX/dist/src/main.js" <<'FAKE_APP'
require('node:fs').appendFileSync(process.env.CALL_LOG, 'app started\n');
FAKE_APP

  cat > "$MOUNT_BIN/mountpoint" <<'FAKE_MOUNTPOINT'
#!/usr/bin/env bash
exit "${FAKE_MOUNTPOINT_EXIT:-0}"
FAKE_MOUNTPOINT
  chmod +x "$MOUNT_BIN/mountpoint"
  PATH="$MOUNT_BIN:$PATH"
  export PATH
}

@test "applies pending migrations before starting the app" {
  run "$ENTRYPOINT"

  [ "$status" -eq 0 ]
  [ "$(cat "$CALL_LOG")" = "$(printf '%s\n%s' "$MIGRATE_MARKER" "$APP_MARKER")" ]
  [[ "$output" == *"entrypoint: applying pending migrations"* ]]
}

@test "stops before starting the app when a migration fails" {
  FAKE_PRISMA_EXIT=1 run "$ENTRYPOINT"

  [ "$status" -eq 1 ]
  [ "$(cat "$CALL_LOG")" = "$MIGRATE_MARKER" ]
}

@test "starts without migrating when SKIP_MIGRATIONS is true" {
  SKIP_MIGRATIONS=true run "$ENTRYPOINT"

  [ "$status" -eq 0 ]
  [ "$(cat "$CALL_LOG")" = "$APP_MARKER" ]
  [[ "$output" == *"SKIP_MIGRATIONS=true"* ]]
}

@test "creates the data directory named by RABBIT_MAXIMIZER_DATA_DIR" {
  local data_dir="$BATS_TEST_TMPDIR/data"

  RABBIT_MAXIMIZER_DATA_DIR="$data_dir" run "$ENTRYPOINT"

  [ "$status" -eq 0 ]
  [ -d "$data_dir" ]
}

@test "creates the data directory under the project root by default" {
  run "$ENTRYPOINT"

  [ "$status" -eq 0 ]
  [ -d "$SANDBOX/data" ]
}

@test "starts when the data directory is a mount" {
  mkdir -p "$SANDBOX/data"

  run "$ENTRYPOINT"

  [ "$status" -eq 0 ]
  [ "$(cat "$CALL_LOG")" = "$(printf '%s\n%s' "$MIGRATE_MARKER" "$APP_MARKER")" ]
}

@test "refuses to start when the data directory is not a mount" {
  mkdir -p "$SANDBOX/data"

  FAKE_MOUNTPOINT_EXIT=1 run "$ENTRYPOINT"

  [ "$status" -eq 1 ]
  [ ! -f "$CALL_LOG" ]
  [[ "$output" == *"is not a mount"* ]]
  [[ "$output" == *"-v rabbit-maximizer-data:"* ]]
}

@test "warns when a directory sits at the configuration path" {
  mkdir -p "$SANDBOX/.env"

  run "$ENTRYPOINT"

  [ "$status" -eq 0 ]
  [[ "$output" == *"is a directory, so the configuration never arrived"* ]]
  [ "$(cat "$CALL_LOG")" = "$(printf '%s\n%s' "$MIGRATE_MARKER" "$APP_MARKER")" ]
}

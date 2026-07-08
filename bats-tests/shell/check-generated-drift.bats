#!/usr/bin/env bats

SCRIPT="$(dirname "$BATS_TEST_FILENAME")/../../.github/actions/check-generated-drift/check-generated-drift.sh"

setup() {
  TEST_TEMP_DIR="$(mktemp -d)"
  export TEST_TEMP_DIR

  mkdir -p "$TEST_TEMP_DIR/bin"
  export PATH="$TEST_TEMP_DIR/bin:$PATH"

  # Mock pnpm that succeeds by default
  cat > "$TEST_TEMP_DIR/bin/pnpm" <<'MOCK'
#!/usr/bin/env bash
exit 0
MOCK
  chmod +x "$TEST_TEMP_DIR/bin/pnpm"

  # Mock git that reports no changes by default
  cat > "$TEST_TEMP_DIR/bin/git" <<'MOCK'
#!/usr/bin/env bash
if [ "$1" = "diff" ]; then
  exit 0
fi
exit 0
MOCK
  chmod +x "$TEST_TEMP_DIR/bin/git"

  cd "$TEST_TEMP_DIR"
}

teardown() {
  rm -rf "${TEST_TEMP_DIR:?}"
}

@test "types are in sync -> exits 0" {
  run bash "$SCRIPT"
  [ "$status" -eq 0 ]
}

@test "drift detected -> exits 1 with error message" {
  cat > "$TEST_TEMP_DIR/bin/git" <<'MOCK'
#!/usr/bin/env bash
if [ "$1" = "diff" ]; then
  for arg in "$@"; do
    if [ "$arg" = "--quiet" ]; then
      exit 1
    fi
  done
  echo "src/api-types.ts"
  exit 0
fi
exit 0
MOCK

  run bash "$SCRIPT"
  [ "$status" -eq 1 ]
  echo "$output" | grep -q "Drifted files:"
  echo "$output" | grep -q "src/api-types.ts"
  echo "$output" | grep -q "generated files are out of sync"
  echo "$output" | grep -q "Run 'pnpm api:types' locally and commit the result."
}

@test "pnpm not found -> exits 2" {
  run bash -c '
    command() {
      if [ "$1" = "-v" ] && [ "$2" = "pnpm" ]; then
        return 1
      fi
      builtin command "$@"
    }
    . "$1"
  ' -- "$SCRIPT"
  [ "$status" -eq 2 ]
  echo "$output" | grep -q "pnpm is required"
}

@test "custom pnpm script via PNPM_SCRIPT env var -> exits 0" {
  export PNPM_SCRIPT="generate-client"

  cat > "$TEST_TEMP_DIR/bin/pnpm" <<'MOCK'
#!/usr/bin/env bash
if [ "$1" != "generate-client" ]; then
  echo "expected generate-client, got $1" >&2
  exit 1
fi
exit 0
MOCK

  cat > "$TEST_TEMP_DIR/bin/git" <<'MOCK'
#!/usr/bin/env bash
if [ "$1" = "diff" ]; then
  exit 0
fi
exit 0
MOCK

  run bash "$SCRIPT"
  [ "$status" -eq 0 ]
}

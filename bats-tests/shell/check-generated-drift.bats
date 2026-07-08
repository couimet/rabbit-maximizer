#!/usr/bin/env bats

SCRIPT="$(dirname "$BATS_TEST_FILENAME")/../../.github/actions/check-generated-drift/check-generated-drift.sh"

setup() {
  TEST_TEMP_DIR="$(mktemp -d)"
  export TEST_TEMP_DIR

  mkdir -p "$TEST_TEMP_DIR/bin"
  export PATH="$TEST_TEMP_DIR/bin:$PATH"

  # Mock git that reports no changes by default
  cat > "$TEST_TEMP_DIR/bin/git" <<'MOCK'
#!/usr/bin/env bash
if [ "$1" = "diff" ]; then
  exit 0
fi
exit 0
MOCK
  chmod +x "$TEST_TEMP_DIR/bin/git"

  # GITHUB_OUTPUT for capturing outputs in tests
  export GITHUB_OUTPUT="$TEST_TEMP_DIR/github_output"
  touch "$GITHUB_OUTPUT"

  cd "$TEST_TEMP_DIR"
}

teardown() {
  rm -rf "${TEST_TEMP_DIR:?}"
}

@test "command succeeds, no git changes -> exits 0, no comment-file output" {
  export COMMAND="echo 'regenerated'"

  run bash "$SCRIPT"
  [ "$status" -eq 0 ]
  run grep "comment-file" "$GITHUB_OUTPUT"
  [ "$status" -eq 1 ]
}

@test "command succeeds, git changes detected -> exits 0, outputs comment-file" {
  export COMMAND="echo 'regenerated'"

  cat > "$TEST_TEMP_DIR/bin/git" <<'MOCK'
#!/usr/bin/env bash
if [ "$1" = "diff" ]; then
  if [ "$2" = "--quiet" ]; then
    exit 1
  fi
  if [ "$2" = "--name-only" ]; then
    echo "src/api-types.ts"
    exit 0
  fi
fi
exit 0
MOCK

  run bash "$SCRIPT"
  [ "$status" -eq 0 ]

  # Verify comment-file was written to GITHUB_OUTPUT
  grep -q "comment-file=" "$GITHUB_OUTPUT"

  COMMENT_FILE="$(grep 'comment-file=' "$GITHUB_OUTPUT" | sed 's/comment-file=//')"
  [ -f "$COMMENT_FILE" ]

  # Verify comment content
  grep -q "Generated drift detected" "$COMMENT_FILE"
  grep -q "src/api-types.ts" "$COMMENT_FILE"
  grep -q "echo 'regenerated'" "$COMMENT_FILE"
}

@test "COMMAND not set -> exits 1 with error message" {
  run bash "$SCRIPT"
  [ "$status" -eq 1 ]
  echo "$output" | grep -q "COMMAND is required"
}

@test "working-directory set -> runs command in that directory" {
  mkdir -p "$TEST_TEMP_DIR/subdir"
  local cwd_tracker="$TEST_TEMP_DIR/cwd-tracker"
  export GITHUB_OUTPUT="$TEST_TEMP_DIR/github_output"

  # Mock that tracks cwd via a side-effect file
  cat > "$TEST_TEMP_DIR/bin/pnpm" <<MOCK
#!/usr/bin/env bash
echo "\$(pwd)" > "$cwd_tracker"
exit 0
MOCK
  chmod +x "$TEST_TEMP_DIR/bin/pnpm"

  export COMMAND="pnpm api:types"

  # Simulate working-directory by cd'ing before running
  run bash -c "cd '$TEST_TEMP_DIR/subdir' && bash '$SCRIPT'"
  [ "$status" -eq 0 ]
  [ "$(cat "$cwd_tracker")" = "$TEST_TEMP_DIR/subdir" ]
}

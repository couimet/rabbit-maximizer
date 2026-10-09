#!/usr/bin/env bats

load test_helper

# The test suite talks to no network, so the sandbox holds a fake gh. Mocking by
# path keeps test-only overrides out of the script. The fake answers the same
# projection the script asks gh for: one tab-separated line per check run.

SCRIPT="$SCRIPT_DIR/release/verify-ci-status.sh"
REPOSITORY='couimet/rabbit-maximizer'
COMMIT_SHA='0123456789abcdef0123456789abcdef01234567'

setup() {
  CALL_LOG="$BATS_TEST_TMPDIR/calls.log"
  CALL_COUNT_FILE="$BATS_TEST_TMPDIR/call-count"
  BIN_DIR="$BATS_TEST_TMPDIR/bin"
  export CALL_LOG CALL_COUNT_FILE

  PASSING_RUNS=$'completed\tsuccess\tbuild\ncompleted\tsuccess\tlint'
  UNFINISHED_RUNS=$'completed\tsuccess\tbuild\nin_progress\tnone\tlint'
  FAILING_RUNS=$'completed\tsuccess\tbuild\ncompleted\tfailure\tlint'

  export REPOSITORY COMMIT_SHA
  export SETTLE_AFTER_CALL=1
  export PENDING_RUNS="$UNFINISHED_RUNS"
  export SETTLED_RUNS="$PASSING_RUNS"
  export POLL_INTERVAL_SEC=1

  mkdir -p "$BIN_DIR"
  cat > "$BIN_DIR/gh" <<'FAKE_GH'
#!/usr/bin/env bash
echo "gh $*" >> "$CALL_LOG"

calls=0
if [ -f "$CALL_COUNT_FILE" ]; then
  calls="$(cat "$CALL_COUNT_FILE")"
fi
calls=$((calls + 1))
printf '%s\n' "$calls" > "$CALL_COUNT_FILE"

if [ "$calls" -lt "$SETTLE_AFTER_CALL" ]; then
  printf '%s\n' "$PENDING_RUNS"
else
  printf '%s\n' "$SETTLED_RUNS"
fi
FAKE_GH
  chmod +x "$BIN_DIR/gh"
  PATH="$BIN_DIR:$PATH"
  export PATH
}

verify_ci_status() {
  bash "$SCRIPT"
}

@test "passes a commit whose check runs all passed" {
  run verify_ci_status

  [ "$status" -eq 0 ]
  [[ "$output" == *"Every check run on $COMMIT_SHA passed"* ]]
  [[ "$(cat "$CALL_LOG")" == *"repos/$REPOSITORY/commits/$COMMIT_SHA/check-runs"* ]]
}

@test "refuses a commit with a failed check run, and names it" {
  export SETTLED_RUNS="$FAILING_RUNS"

  run verify_ci_status

  [ "$status" -eq 1 ]
  [[ "$output" == *"check 'lint' concluded 'failure'"* ]]
  [[ "$output" == *"Refusing to publish $COMMIT_SHA"* ]]
}

@test "refuses a commit with a cancelled check run, and names it" {
  export SETTLED_RUNS=$'completed\tsuccess\tbuild\ncompleted\tcancelled\tlint'

  run verify_ci_status

  [ "$status" -eq 1 ]
  [[ "$output" == *"check 'lint' concluded 'cancelled'"* ]]
}

@test "waits while a check run is unfinished, then passes when it settles" {
  export SETTLE_AFTER_CALL=2

  run verify_ci_status

  [ "$status" -eq 0 ]
  [[ "$output" == *"Waiting 1s for the check runs on $COMMIT_SHA"* ]]
  [[ "$output" == *"Every check run on $COMMIT_SHA passed"* ]]
  [ "$(cat "$CALL_COUNT_FILE")" -eq 2 ]
}

@test "refuses when a check run is unfinished past the timeout" {
  export SETTLED_RUNS="$UNFINISHED_RUNS"
  export WAIT_TIMEOUT_SEC=2

  run verify_ci_status

  [ "$status" -eq 1 ]
  [[ "$output" == *"A check run on $COMMIT_SHA is unfinished after 2s"* ]]
}

@test "refuses when no check run covers the commit" {
  export SETTLED_RUNS=''
  export WAIT_TIMEOUT_SEC=2

  run verify_ci_status

  [ "$status" -eq 1 ]
  [[ "$output" == *"No check run covers $COMMIT_SHA after 2s"* ]]
}

@test "refuses when the repository is not set" {
  unset REPOSITORY

  run verify_ci_status

  [ "$status" -ne 0 ]
  [[ "$output" == *'REPOSITORY is required'* ]]
}

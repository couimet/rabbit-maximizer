#!/usr/bin/env bats

load test_helper

# The test suite talks to no network, so the sandbox holds a fake gh. Mocking by
# path keeps test-only overrides out of the script. The fake answers the two
# read endpoints of the script, and each one prints the projection the script
# asks gh for: one tab-separated line per check run or per workflow run.

SCRIPT="$SCRIPT_DIR/release/verify-ci-status.sh"
REPOSITORY='couimet/rabbit-maximizer'
COMMIT_SHA='0123456789abcdef0123456789abcdef01234567'
# The workflow reads github.job, which holds the job id. This suite stands in
# for that value, so a fixture can name a check run of the calling job.
SELF_CHECK_NAME='publish'
# github.run_id names the workflow run that holds the calling job. A fixture
# uses a second id to stand in for a run of another workflow.
SELF_RUN_ID='1000000001'
OTHER_RUN_ID='2000000002'
CI_RUN_ID='3000000003'
REQUIRED_WORKFLOW_FILE='ci.yml'

setup() {
  CALL_LOG="$BATS_TEST_TMPDIR/calls.log"
  CALL_COUNT_FILE="$BATS_TEST_TMPDIR/call-count"
  BIN_DIR="$BATS_TEST_TMPDIR/bin"
  export CALL_LOG CALL_COUNT_FILE

  # Each check run carries the run id of another workflow. The gate drops only
  # the run of the calling job, so a passing report names a run id of its own.
  PASSING_RUNS="$(printf 'completed\tsuccess\tbuild\t%s\ncompleted\tsuccess\tlint\t%s\n' "$OTHER_RUN_ID" "$OTHER_RUN_ID")"
  UNFINISHED_RUNS="$(printf 'completed\tsuccess\tbuild\t%s\nin_progress\tnone\tlint\t%s\n' "$OTHER_RUN_ID" "$OTHER_RUN_ID")"
  FAILING_RUNS="$(printf 'completed\tsuccess\tbuild\t%s\ncompleted\tfailure\tlint\t%s\n' "$OTHER_RUN_ID" "$OTHER_RUN_ID")"

  export REPOSITORY COMMIT_SHA SELF_CHECK_NAME SELF_RUN_ID REQUIRED_WORKFLOW_FILE
  export SETTLE_AFTER_CALL=1
  export PENDING_RUNS="$UNFINISHED_RUNS"
  export SETTLED_RUNS="$PASSING_RUNS"
  export WORKFLOW_RUNS="$(printf 'completed\tsuccess\t%s\n' "$CI_RUN_ID")"
  export POLL_INTERVAL_SEC=1

  mkdir -p "$BIN_DIR"
  cat > "$BIN_DIR/gh" <<'FAKE_GH'
#!/usr/bin/env bash
echo "gh $*" >> "$CALL_LOG"

# The read of the check runs is the one that advances the call count, so
# SETTLE_AFTER_CALL counts loop iterations rather than the two reads each
# iteration makes.
if [[ "$*" == *"/actions/workflows/"* ]]; then
  printf '%s\n' "$WORKFLOW_RUNS"
  exit 0
fi

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
  [[ "$output" == *"$REQUIRED_WORKFLOW_FILE concluded a passing result"* ]]
  [[ "$(cat "$CALL_LOG")" == *"repos/$REPOSITORY/commits/$COMMIT_SHA/check-runs"* ]]
  [[ "$(cat "$CALL_LOG")" == *"repos/$REPOSITORY/actions/workflows/$REQUIRED_WORKFLOW_FILE/runs?head_sha=$COMMIT_SHA"* ]]
}

@test "refuses a commit with a failed check run, and names it" {
  export SETTLED_RUNS="$FAILING_RUNS"

  run verify_ci_status

  [ "$status" -eq 1 ]
  [[ "$output" == *"check 'lint' concluded 'failure'"* ]]
  [[ "$output" == *"Refusing to publish $COMMIT_SHA"* ]]
}

@test "refuses a commit with a cancelled check run, and names it" {
  export SETTLED_RUNS="$(printf 'completed\tsuccess\tbuild\t%s\ncompleted\tcancelled\tlint\t%s\n' "$OTHER_RUN_ID" "$OTHER_RUN_ID")"

  run verify_ci_status

  [ "$status" -eq 1 ]
  [[ "$output" == *"check 'lint' concluded 'cancelled'"* ]]
}

@test "refuses a failed check run that carries the name of the calling job in another run" {
  # A dispatch publishes edge from the same commit, so its completed check run
  # carries the name of the calling job and the id of another workflow run. That
  # run must still stop the release.
  export SETTLED_RUNS="$(printf 'completed\tsuccess\tbuild\t%s\ncompleted\tfailure\tpublish\t%s\n' "$OTHER_RUN_ID" "$OTHER_RUN_ID")"

  run verify_ci_status

  [ "$status" -eq 1 ]
  [[ "$output" == *"check 'publish' concluded 'failure'"* ]]
}

@test "waits while a check run is unfinished, then passes when it settles" {
  export SETTLE_AFTER_CALL=2

  run verify_ci_status

  [ "$status" -eq 0 ]
  [[ "$output" == *"Waiting 1s for the check runs on $COMMIT_SHA"* ]]
  [[ "$output" == *"Every check run on $COMMIT_SHA passed"* ]]
  [ "$(cat "$CALL_COUNT_FILE")" -eq 2 ]
}

@test "ignores an in-progress check run of its own job and passes without waiting" {
  # A short timeout ends the test in seconds when the gate stops ignoring its
  # own run, instead of holding the suite for the default ten minutes.
  export WAIT_TIMEOUT_SEC=2
  export SETTLED_RUNS="$(printf 'completed\tsuccess\tbuild\t%s\nin_progress\tnone\tpublish\t%s\n' "$OTHER_RUN_ID" "$SELF_RUN_ID")"

  run verify_ci_status

  [ "$status" -eq 0 ]
  [[ "$output" == *"Every check run on $COMMIT_SHA passed"* ]]
  [[ "$output" != *'Waiting '* ]]
  [ "$(cat "$CALL_COUNT_FILE")" -eq 1 ]
}

@test "refuses when the calling job name is not set" {
  unset SELF_CHECK_NAME

  run verify_ci_status

  [ "$status" -ne 0 ]
  [[ "$output" == *'SELF_CHECK_NAME is required'* ]]
}

@test "refuses when the calling job run id is not set" {
  unset SELF_RUN_ID

  run verify_ci_status

  [ "$status" -ne 0 ]
  [[ "$output" == *'SELF_RUN_ID is required'* ]]
}

@test "refuses when the required workflow file is not set" {
  unset REQUIRED_WORKFLOW_FILE

  run verify_ci_status

  [ "$status" -ne 0 ]
  [[ "$output" == *'REQUIRED_WORKFLOW_FILE is required'* ]]
}

@test "refuses a commit whose CI workflow run concluded without a pass" {
  export WORKFLOW_RUNS="$(printf 'completed\tfailure\t%s\n' "$CI_RUN_ID")"

  run verify_ci_status

  [ "$status" -eq 1 ]
  [[ "$output" == *"No run of $REQUIRED_WORKFLOW_FILE on $COMMIT_SHA concluded a passing result"* ]]
}

@test "refuses a commit with no run of the required workflow" {
  export WORKFLOW_RUNS=''
  export WAIT_TIMEOUT_SEC=2

  run verify_ci_status

  [ "$status" -eq 1 ]
  [[ "$output" == *"No completed run of $REQUIRED_WORKFLOW_FILE covers $COMMIT_SHA after 2s"* ]]
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

#!/usr/bin/env bats

load test_helper

# Docker is not available to a unit test, and the working tree of the test run
# must not decide the tag, so the sandbox holds fake binaries. Mocking by path
# keeps test-only overrides out of the script.

SCRIPT="$SCRIPT_DIR/docker/push-adhoc-image.sh"
IMAGE_REPO='ghcr.io/couimet/rabbit-maximizer'
COMMIT_SHA='0123456789abcdef0123456789abcdef01234567'
SHORT_SHA='0123456'
AMD64_PLATFORM='linux/amd64'
ARM64_PLATFORM='linux/arm64'
BOTH_PLATFORM='linux/amd64,linux/arm64'
# The timestamp is the clock at run time, so the test pins the shape and the
# commit, not the instant.
TAG_PATTERN="^$IMAGE_REPO:$SHORT_SHA-[0-9]{8}-[0-9]{6}$"

setup() {
  CALL_LOG="$BATS_TEST_TMPDIR/calls.log"
  BIN_DIR="$BATS_TEST_TMPDIR/bin"
  FAKE_COMMIT_SHA="$COMMIT_SHA"
  export CALL_LOG FAKE_COMMIT_SHA

  mkdir -p "$BIN_DIR"
  cat > "$BIN_DIR/docker" <<'FAKE_DOCKER'
#!/usr/bin/env bash
echo "docker $*" >> "$CALL_LOG"

case "$1" in
  build)
    exit "${FAKE_BUILD_FAILS:-0}"
    ;;
  push)
    exit "${FAKE_PUSH_FAILS:-0}"
    ;;
esac
FAKE_DOCKER
  chmod +x "$BIN_DIR/docker"

  cat > "$BIN_DIR/git" <<'FAKE_GIT'
#!/usr/bin/env bash
echo "git $*" >> "$CALL_LOG"

case "$*" in
  'rev-parse HEAD')
    echo "$FAKE_COMMIT_SHA"
    ;;
  'status --porcelain')
    echo "${FAKE_TREE_STATUS:-}"
    ;;
esac
FAKE_GIT
  chmod +x "$BIN_DIR/git"

  PATH="$BIN_DIR:$PATH"
  export PATH
}

push_adhoc() {
  bash "$SCRIPT" "$@"
}

build_line() {
  grep '^docker build' "$CALL_LOG"
}

tagged_ref() {
  sed -n 's/.*--build-arg IMAGE_TAGS=\([^ ]*\).*/\1/p' "$CALL_LOG"
}

@test "builds one platform into the local store and pushes it under the commit and a UTC timestamp" {
  run push_adhoc amd64

  [ "$status" -eq 0 ]
  local calls build
  calls="$(cat "$CALL_LOG")"
  build="$(build_line)"
  [[ "$calls" == *'git rev-parse HEAD'* ]]
  [[ "$build" == *"--platform $AMD64_PLATFORM"* ]]
  [[ "$build" == *'--load'* ]]
  [[ "$build" != *'--push'* ]]
  [[ "$build" == *"--build-arg GIT_SHA=$COMMIT_SHA"* ]]
  [[ "$build" == *" $PROJECT_ROOT" ]]

  local pushed
  pushed="$(tagged_ref)"
  [[ "$pushed" =~ $TAG_PATTERN ]]
  [[ "$calls" == *"docker push $pushed"* ]]
  [[ "$output" == *"Pushed $pushed for $AMD64_PLATFORM"* ]]
  [[ "$output" == *"docker pull $pushed"* ]]
}

@test "builds for ARM hosts" {
  run push_adhoc arm64

  [ "$status" -eq 0 ]
  [[ "$(build_line)" == *"--platform $ARM64_PLATFORM"* ]]
  [[ "$(build_line)" == *'--load'* ]]
}

@test "pushes during the build when the target holds two platforms" {
  run push_adhoc both

  [ "$status" -eq 0 ]
  local pushed
  pushed="$(tagged_ref)"
  [[ "$(build_line)" == *"--platform $BOTH_PLATFORM"* ]]
  [[ "$(build_line)" == *'--push'* ]]
  [[ "$(build_line)" != *'--load'* ]]
  [[ "$(grep -c '^docker push' "$CALL_LOG")" -eq 0 ]]
  [[ "$pushed" =~ $TAG_PATTERN ]]
  [[ "$output" == *"Pushed $pushed for $BOTH_PLATFORM"* ]]
}

@test "pushes to the repository named by IMAGE_REPO" {
  IMAGE_REPO='registry.example.com/team/rabbit-maximizer' run push_adhoc amd64

  [ "$status" -eq 0 ]
  [[ "$(tagged_ref)" =~ ^registry\.example\.com/team/rabbit-maximizer:$SHORT_SHA-[0-9]{8}-[0-9]{6}$ ]]
}

@test "prints the usage when the target is missing" {
  run push_adhoc

  [ "$status" -eq 1 ]
  [[ "$output" == *'Usage: push-adhoc-image.sh <target>'* ]]
  [ ! -f "$CALL_LOG" ]
}

@test "rejects a target it does not know" {
  run push_adhoc ppc64le

  [ "$status" -eq 1 ]
  [[ "$output" == *"Unknown target 'ppc64le'"* ]]
  [[ "$output" == *'Usage: push-adhoc-image.sh <target>'* ]]
  [ ! -f "$CALL_LOG" ]
}

@test "reports a working tree that holds uncommitted changes" {
  FAKE_TREE_STATUS=' M src/main.ts' run push_adhoc amd64

  [ "$status" -eq 0 ]
  [[ "$output" == *"The working tree holds changes that commit $SHORT_SHA does not"* ]]
}

@test "says nothing about the tree when it holds no change" {
  run push_adhoc amd64

  [ "$status" -eq 0 ]
  [[ "$output" != *'The working tree holds changes'* ]]
}

@test "stops before the push when the build fails" {
  FAKE_BUILD_FAILS=1 run push_adhoc amd64

  [ "$status" -eq 1 ]
  [[ "$(cat "$CALL_LOG")" != *'docker push'* ]]
  [[ "$output" != *'Pushed '* ]]
}

@test "reports a refused push and names the way to finish it" {
  FAKE_PUSH_FAILS=1 run push_adhoc amd64

  [ "$status" -eq 1 ]
  [[ "$(cat "$CALL_LOG")" == *'docker push'* ]]
  [[ "$output" == *'docker login ghcr.io'* ]]
  [[ "$output" == *"docker push $(tagged_ref)"* ]]
  [[ "$output" != *'Pushed '* ]]
}

@test "names the login when a two-platform build stops at its push" {
  FAKE_BUILD_FAILS=1 run push_adhoc both

  [ "$status" -eq 1 ]
  [[ "$output" == *'docker login ghcr.io'* ]]
  [[ "$output" == *'pnpm docker:push:adhoc:both'* ]]
}

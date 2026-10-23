#!/usr/bin/env bats

load test_helper

# Docker is not available to a unit test, so the sandbox holds a fake docker and
# a fake smoke test. Mocking by path keeps test-only overrides out of the script.

VERSION='0.1.0'
RELEASE_TAG='v0.1.0'

setup() {
  SANDBOX="$BATS_TEST_TMPDIR/tree"
  CALL_LOG="$BATS_TEST_TMPDIR/calls.log"
  BIN_DIR="$BATS_TEST_TMPDIR/bin"
  ENV_FILE_PATH="$SANDBOX/.env.ci"
  export CALL_LOG

  mkdir -p "$SANDBOX/scripts/release" "$SANDBOX/scripts/docker" "$SANDBOX/docs" "$BIN_DIR"
  cp "$SCRIPT_DIR/release/generate-publishing-instructions.sh" "$SANDBOX/scripts/release/"
  cp "$SCRIPT_DIR/release/lock-version.sh" "$SANDBOX/scripts/release/"
  cp "$SCRIPT_DIR/docker/derive-image-tags.sh" "$SANDBOX/scripts/docker/"
  cp "$PROJECT_ROOT/package.json" "$SANDBOX/"
  cp "$PROJECT_ROOT/CHANGELOG.md" "$SANDBOX/"
  cp "$PROJECT_ROOT/docs/api-spec.yaml" "$SANDBOX/docs/"
  cp "$PROJECT_ROOT/.env.ci" "$SANDBOX/"

  cat > "$SANDBOX/scripts/docker/smoke-test.sh" <<'FAKE_SMOKE_TEST'
#!/usr/bin/env bash
echo "smoke-test IMAGE_REF=$IMAGE_REF ENV_FILE=$ENV_FILE" >> "$CALL_LOG"
exit "${FAKE_SMOKE_EXIT:-0}"
FAKE_SMOKE_TEST

  cat > "$BIN_DIR/docker" <<'FAKE_DOCKER'
#!/usr/bin/env bash
echo "docker $*" >> "$CALL_LOG"
exit "${FAKE_DOCKER_EXIT:-0}"
FAKE_DOCKER
  chmod +x "$BIN_DIR/docker" "$SANDBOX/scripts/docker/smoke-test.sh"
  PATH="$BIN_DIR:$PATH"
  export PATH

  cd "$SANDBOX" || return
  git init -q
  git config user.email 'bats@example.com'
  git config user.name 'Bats'
  git add -A
  git commit -q -m 'fixture'

  # The generator runs after the version lock, so the fixture starts locked.
  bash "$SANDBOX/scripts/release/lock-version.sh" "$VERSION"
  git add -A
  git commit -q -m 'locked fixture'
}

commit_all() {
  git add -A
  git commit -q -m "$1"
}

generate() {
  bash "$SANDBOX/scripts/release/generate-publishing-instructions.sh"
}

@test "writes the runbook when every check passes" {
  run generate
  [ "$status" -eq 0 ]
  [ -f "$SANDBOX/publishing-instructions/publish-$RELEASE_TAG.md" ]
  [[ "$output" == *"Wrote $SANDBOX/publishing-instructions/publish-$RELEASE_TAG.md"* ]]
}

@test "names the tags that the publish workflow derives" {
  run generate
  [ "$status" -eq 0 ]

  local runbook
  runbook="$(cat "$SANDBOX/publishing-instructions/publish-$RELEASE_TAG.md")"
  [[ "$runbook" == *"This release publishes these tags: 0.1.0, 0.1, latest."* ]]
  [[ "$runbook" == *"docker manifest inspect ghcr.io/couimet/rabbit-maximizer:latest"* ]]
}

@test "smoke tests the built image before it writes the runbook" {
  run generate
  [ "$status" -eq 0 ]

  local calls
  calls="$(cat "$CALL_LOG")"
  [[ "$calls" == *"docker build -t rabbit-maximizer:release $SANDBOX"* ]]
  [[ "$calls" == *"smoke-test IMAGE_REF=rabbit-maximizer:release ENV_FILE=$ENV_FILE_PATH"* ]]
}

@test "refuses a dirty working tree and writes no runbook" {
  echo 'trailing change' >> "$SANDBOX/CHANGELOG.md"

  run generate

  [ "$status" -eq 1 ]
  [[ "$output" == *'FAIL: clean working tree'* ]]
  [ ! -d "$SANDBOX/publishing-instructions" ]
}

@test "refuses a prerelease version" {
  printf '{\n  "name": "rabbit-maximizer",\n  "version": "0.2.0-beta.1"\n}\n' > "$SANDBOX/package.json"
  commit_all 'prerelease version'

  run generate

  [ "$status" -eq 1 ]
  [[ "$output" == *'FAIL: stable version'* ]]
  [ ! -d "$SANDBOX/publishing-instructions" ]
}

@test "refuses a release tag that already exists" {
  git tag "$RELEASE_TAG"

  run generate

  [ "$status" -eq 1 ]
  [[ "$output" == *"FAIL: unused release tag"* ]]
  [ ! -d "$SANDBOX/publishing-instructions" ]
}

@test "refuses a changelog with no version heading" {
  printf '# Changelog\n\n## [Unreleased]\n' > "$SANDBOX/CHANGELOG.md"
  commit_all 'changelog without the version heading'

  run generate

  [ "$status" -eq 1 ]
  [[ "$output" == *'FAIL: changelog heading'* ]]
  [ ! -d "$SANDBOX/publishing-instructions" ]
}

@test "refuses a changelog with no version reference link" {
  printf '# Changelog\n\n## [%s] - 2026-01-01\n' "$VERSION" > "$SANDBOX/CHANGELOG.md"
  commit_all 'changelog without the version reference link'

  run generate

  [ "$status" -eq 1 ]
  [[ "$output" == *'FAIL: changelog reference link'* ]]
  [ ! -d "$SANDBOX/publishing-instructions" ]
}

@test "writes no runbook when the smoke test fails" {
  FAKE_SMOKE_EXIT=1 run generate

  [ "$status" -eq 1 ]
  [[ "$output" == *'FAIL: smoke test'* ]]
  [ ! -d "$SANDBOX/publishing-instructions" ]
}

@test "writes no runbook when the image build fails" {
  FAKE_DOCKER_EXIT=1 run generate

  [ "$status" -eq 1 ]
  [[ "$output" == *'FAIL: image build'* ]]
  [ ! -d "$SANDBOX/publishing-instructions" ]
}

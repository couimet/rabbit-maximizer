#!/usr/bin/env bats

load test_helper

PROJECT_URL='https://github.com/couimet/rabbit-maximizer'
FIXTURE_VERSION='0.1.0'

# The fixture files are written here, not copied from the repository. A copy
# tracks the live release state, so a locked tree breaks every test in setup.
write_fixture_tree() {
  printf '{\n  "name": "rabbit-maximizer",\n  "version": "%s"\n}\n' "$FIXTURE_VERSION" \
    > "$SANDBOX/package.json"
  printf "openapi: 3.0.0\ninfo:\n  title: Rabbit Maximizer\n  version: '%s'\n" "$FIXTURE_VERSION" \
    > "$SANDBOX/docs/api-spec.yaml"
  cat > "$SANDBOX/CHANGELOG.md" <<FIXTURE_CHANGELOG
# Changelog

## [Unreleased]

### Added

- A change

[Unreleased]: $PROJECT_URL/commits/main
FIXTURE_CHANGELOG
}

setup() {
  SANDBOX="$BATS_TEST_TMPDIR/tree"
  REAL_GIT="$(command -v git)"
  mkdir -p "$SANDBOX/scripts/release" "$SANDBOX/docs"
  cp "$SCRIPT_DIR/release/lock-version.sh" "$SANDBOX/scripts/release/"
  write_fixture_tree
  cd "$SANDBOX" || return
  git init -q
  git config user.email 'bats@example.com'
  git config user.name 'Bats'
  git add -A
  git commit -q -m 'fixture'
}

lock_version() {
  bash "$SANDBOX/scripts/release/lock-version.sh" "$@"
}

@test "locks a stable version and renames the changelog section" {
  lock_version '0.2.0'

  local changelog
  changelog="$(cat "$SANDBOX/CHANGELOG.md")"
  run grep -F "\"version\": \"0.2.0\"" "$SANDBOX/package.json"
  [ "$status" -eq 0 ]
  run grep -F "  version: '0.2.0'" "$SANDBOX/docs/api-spec.yaml"
  [ "$status" -eq 0 ]
  [[ "$changelog" == *"## [0.2.0] - $(date -u +%Y-%m-%d)"* ]]
  [[ "$changelog" != *'[Unreleased]'* ]]
}

@test "points the reference link at the release when no earlier tag exists" {
  lock_version '0.2.0'

  local changelog
  changelog="$(cat "$SANDBOX/CHANGELOG.md")"
  [[ "$changelog" == *"[0.2.0]: $PROJECT_URL/releases/tag/v0.2.0"* ]]
}

@test "points the reference link at the compare against the previous release tag" {
  git tag 'v0.1.0'

  lock_version '0.2.0'

  local changelog
  changelog="$(cat "$SANDBOX/CHANGELOG.md")"
  [[ "$changelog" == *"[0.2.0]: $PROJECT_URL/compare/v0.1.0...v0.2.0"* ]]
}

@test "ignores a prerelease tag when it points the reference link" {
  # The tag list sorts v0.2.0-beta.1 above v0.1.0, so a check that only skips
  # the locked tag would compare against the prerelease.
  git tag 'v0.1.0'
  git tag 'v0.2.0-beta.1'

  lock_version '0.2.0'

  local changelog
  changelog="$(cat "$SANDBOX/CHANGELOG.md")"
  [[ "$changelog" == *"[0.2.0]: $PROJECT_URL/compare/v0.1.0...v0.2.0"* ]]
}

@test "points the reference link at the release when only a prerelease tag exists" {
  git tag 'v0.2.0-beta.1'

  lock_version '0.2.0'

  local changelog
  changelog="$(cat "$SANDBOX/CHANGELOG.md")"
  [[ "$changelog" == *"[0.2.0]: $PROJECT_URL/releases/tag/v0.2.0"* ]]
}

@test "changes nothing on a second run for the same version" {
  lock_version '0.2.0'
  local before
  before="$(cat "$SANDBOX/CHANGELOG.md")"

  run lock_version '0.2.0'

  [ "$status" -eq 0 ]
  [[ "$output" == *"already locked"* ]]
  [ "$(cat "$SANDBOX/CHANGELOG.md")" = "$before" ]
}

@test "does not report a version as already locked while the API spec is behind" {
  lock_version '0.2.0'
  printf "openapi: 3.0.0\ninfo:\n  title: Rabbit Maximizer\n  version: '%s'\n" "$FIXTURE_VERSION" \
    > "$SANDBOX/docs/api-spec.yaml"
  git add -A
  git commit -q -m 'partial lock'

  run lock_version '0.2.0'

  [ "$status" -eq 1 ]
  [[ "$output" != *"already locked"* ]]
  [[ "$output" == *"holds no '## [Unreleased]' heading"* ]]
}

@test "refuses a prerelease version" {
  run lock_version '0.2.0-beta.1'

  [ "$status" -eq 1 ]
  [[ "$output" == *"is a prerelease"* ]]
}

@test "refuses a version that is not SemVer" {
  run lock_version 'v0.2.0'

  [ "$status" -eq 1 ]
  [[ "$output" == *"is not a SemVer version"* ]]
}

@test "refuses when a file it edits is missing, leaving the others alone" {
  rm "$SANDBOX/docs/api-spec.yaml"

  run lock_version '0.2.0'

  [ "$status" -eq 1 ]
  [[ "$output" == *"Required file not found:"* ]]
  [[ "$(cat "$SANDBOX/CHANGELOG.md")" == *'## [Unreleased]'* ]]
}

@test "refuses a dirty working tree" {
  echo 'trailing change' >> "$SANDBOX/CHANGELOG.md"

  run lock_version '0.2.0'

  [ "$status" -eq 1 ]
  [[ "$output" == *"Working tree is dirty"* ]]
}

@test "stops when git cannot report the working tree" {
  # A failed status must not read as a clean tree, so the run stops before it
  # edits a file.
  local bin_dir="$BATS_TEST_TMPDIR/bin"
  mkdir -p "$bin_dir"
  cat > "$bin_dir/git" <<FAKE_GIT
#!/usr/bin/env bash
if [ "\$1" = 'status' ]; then
  exit 128
fi
exec "$REAL_GIT" "\$@"
FAKE_GIT
  chmod +x "$bin_dir/git"

  PATH="$bin_dir:$PATH" run lock_version '0.2.0'

  [ "$status" -ne 0 ]
  [[ "$output" != *'already locked'* ]]
  [ "$(cat "$SANDBOX/CHANGELOG.md")" != *'## [0.2.0]'* ]
}

@test "prints the usage when the version argument is missing" {
  run lock_version

  [ "$status" -eq 1 ]
  [[ "$output" == *"Usage: lock-version.sh <X.Y.Z>"* ]]
}

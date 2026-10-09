#!/usr/bin/env bats

load test_helper

PROJECT_URL='https://github.com/couimet/rabbit-maximizer'

setup() {
  SANDBOX="$BATS_TEST_TMPDIR/tree"
  mkdir -p "$SANDBOX/scripts/release" "$SANDBOX/docs"
  cp "$SCRIPT_DIR/release/lock-version.sh" "$SANDBOX/scripts/release/"
  cp "$PROJECT_ROOT/package.json" "$SANDBOX/"
  cp "$PROJECT_ROOT/docs/api-spec.yaml" "$SANDBOX/docs/"
  cp "$PROJECT_ROOT/CHANGELOG.md" "$SANDBOX/"
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

@test "changes nothing on a second run for the same version" {
  lock_version '0.2.0'
  local before
  before="$(cat "$SANDBOX/CHANGELOG.md")"

  run lock_version '0.2.0'

  [ "$status" -eq 0 ]
  [[ "$output" == *"already locked"* ]]
  [ "$(cat "$SANDBOX/CHANGELOG.md")" = "$before" ]
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

@test "prints the usage when the version argument is missing" {
  run lock_version

  [ "$status" -eq 1 ]
  [[ "$output" == *"Usage: lock-version.sh <X.Y.Z>"* ]]
}

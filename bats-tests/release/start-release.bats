#!/usr/bin/env bats

load test_helper

PROJECT_URL='https://github.com/couimet/rabbit-maximizer'
VERSION='0.1.0'
VERSION_HEADING='## [0.1.0]'

setup() {
  SANDBOX="$BATS_TEST_TMPDIR/tree"
  mkdir -p "$SANDBOX/scripts/release" "$SANDBOX/docs"
  cp "$SCRIPT_DIR/release/start-release.sh" "$SANDBOX/scripts/release/"
  cp "$SCRIPT_DIR/release/lock-version.sh" "$SANDBOX/scripts/release/"
  cp "$PROJECT_ROOT/package.json" "$SANDBOX/"
  cp "$PROJECT_ROOT/CHANGELOG.md" "$SANDBOX/"
  cp "$PROJECT_ROOT/docs/api-spec.yaml" "$SANDBOX/docs/"

  cd "$SANDBOX" || return
  git init -q
  git config user.email 'bats@example.com'
  git config user.name 'Bats'
  git add -A
  git commit -q -m 'fixture'

  # Every release closes with the version lock, so the fixture starts locked.
  bash "$SANDBOX/scripts/release/lock-version.sh" "$VERSION"
  git add -A
  git commit -q -m 'locked fixture'
}

start_release() {
  bash "$SANDBOX/scripts/release/start-release.sh" "$@"
}

line_of() {
  grep -n -F -- "$1" "$SANDBOX/CHANGELOG.md" | cut -d: -f1
}

@test "adds an Unreleased section above the newest version" {
  start_release

  local unreleased_line
  local version_line
  unreleased_line="$(line_of '## [Unreleased]')"
  version_line="$(line_of "$VERSION_HEADING")"
  [ -n "$unreleased_line" ]
  [ "$unreleased_line" -lt "$version_line" ]
}

@test "restores the Unreleased reference link in the compare form" {
  start_release

  local unreleased_line
  local version_line
  unreleased_line="$(line_of '[Unreleased]:')"
  version_line="$(line_of "[$VERSION]:")"
  [ -n "$unreleased_line" ]
  [ "$unreleased_line" -lt "$version_line" ]
  [[ "$(sed -n "${unreleased_line}p" "$SANDBOX/CHANGELOG.md")" == "[Unreleased]: $PROJECT_URL/compare/v$VERSION...HEAD" ]]
}

@test "refuses a second run" {
  start_release

  run start_release

  [ "$status" -eq 1 ]
  [[ "$output" == *"holds a '## [Unreleased]' section already"* ]]
}

@test "refuses a version argument" {
  run start_release '0.2.0'

  [ "$status" -eq 1 ]
  [[ "$output" == *"Usage: start-release.sh"* ]]
}

@test "refuses a dirty working tree" {
  echo 'trailing change' >> "$SANDBOX/CHANGELOG.md"

  run start_release

  [ "$status" -eq 1 ]
  [[ "$output" == *"Working tree is dirty"* ]]
}

@test "refuses a changelog with no version heading" {
  printf '# Changelog\n\nAll notable changes.\n' > "$SANDBOX/CHANGELOG.md"
  git add -A
  git commit -q -m 'changelog without a version heading'

  run start_release

  [ "$status" -eq 1 ]
  [[ "$output" == *"holds no '## [' heading to reopen above"* ]]
}

@test "refuses a changelog whose version has no reference link" {
  printf '# Changelog\n\n## [%s] - 2026-01-01\n' "$VERSION" > "$SANDBOX/CHANGELOG.md"
  git add -A
  git commit -q -m 'changelog without a reference link'

  run start_release

  [ "$status" -eq 1 ]
  [[ "$output" == *"holds no '[$VERSION]:' reference link"* ]]
}

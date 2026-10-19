#!/usr/bin/env bats

load test_helper

IMAGE_REPO='ghcr.io/couimet/rabbit-maximizer'
SHA='0123456789abcdef0123456789abcdef01234567'
PACKAGE_VERSION='9.9.9'

setup() {
  cd "$BATS_TEST_TMPDIR" || return
  printf '{\n  "name": "rabbit-maximizer",\n  "version": "%s"\n}\n' "$PACKAGE_VERSION" > package.json
}

@test "publishes edge and the short SHA for a manual dispatch" {
  EVENT_NAME=workflow_dispatch IMAGE_REPO="$IMAGE_REPO" SHA="$SHA" run bash "$SCRIPT_DIR/docker/derive-image-tags.sh"

  [ "$status" -eq 0 ]
  [ "$output" = "$(printf 'version=%s\ntags=%s:edge,%s:sha-0123456' "$PACKAGE_VERSION" "$IMAGE_REPO" "$IMAGE_REPO")" ]
}

@test "publishes the version, the minor, and latest for a stable release, dropping the v prefix" {
  EVENT_NAME=release RELEASE_TAG='v0.2.0' IS_PRERELEASE='false' IMAGE_REPO="$IMAGE_REPO" SHA="$SHA" run bash "$SCRIPT_DIR/docker/derive-image-tags.sh"

  [ "$status" -eq 0 ]
  [ "$output" = "$(printf 'version=0.2.0\ntags=%s:0.2.0,%s:0.2,%s:latest' "$IMAGE_REPO" "$IMAGE_REPO" "$IMAGE_REPO")" ]
}

@test "publishes the version and the moving beta tag for a prerelease" {
  EVENT_NAME=release RELEASE_TAG='v0.2.0-beta.1' IS_PRERELEASE='true' IMAGE_REPO="$IMAGE_REPO" SHA="$SHA" run bash "$SCRIPT_DIR/docker/derive-image-tags.sh"

  [ "$status" -eq 0 ]
  [ "$output" = "$(printf 'version=0.2.0-beta.1\ntags=%s:0.2.0-beta.1,%s:beta' "$IMAGE_REPO" "$IMAGE_REPO")" ]
}

@test "publishes the moving beta tag for a release candidate" {
  EVENT_NAME=release RELEASE_TAG='v0.2.0-rc.1' IS_PRERELEASE='true' IMAGE_REPO="$IMAGE_REPO" SHA="$SHA" run bash "$SCRIPT_DIR/docker/derive-image-tags.sh"

  [ "$status" -eq 0 ]
  [ "$output" = "$(printf 'version=0.2.0-rc.1\ntags=%s:0.2.0-rc.1,%s:beta' "$IMAGE_REPO" "$IMAGE_REPO")" ]
}

@test "rejects a release tag that is not SemVer" {
  EVENT_NAME=release RELEASE_TAG='v0.2' IS_PRERELEASE='false' IMAGE_REPO="$IMAGE_REPO" SHA="$SHA" run bash "$SCRIPT_DIR/docker/derive-image-tags.sh"

  [ "$status" -eq 1 ]
  [[ "$output" == *"is not a SemVer tag"* ]]
}

@test "rejects an unsupported event" {
  EVENT_NAME=push IMAGE_REPO="$IMAGE_REPO" SHA="$SHA" run bash "$SCRIPT_DIR/docker/derive-image-tags.sh"

  [ "$status" -eq 1 ]
  [[ "$output" == *"unsupported event 'push'"* ]]
}

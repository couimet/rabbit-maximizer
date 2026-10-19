#!/usr/bin/env bash
# Print the version and the image tags for one publish run, in the key=value form
# that $GITHUB_OUTPUT expects. Diagnostics go to stderr, so the caller can append
# stdout to the output file.
#
# Environment:
#   EVENT_NAME     release or workflow_dispatch
#   IMAGE_REPO     registry and repository, for example ghcr.io/couimet/rabbit-maximizer
#   SHA            commit SHA, used for the short tag on a dispatch run
#   RELEASE_TAG    published release tag, required for a release event
#   IS_PRERELEASE  true when the release is a prerelease, required for a release event
set -euo pipefail

SEMVER_TAG_PATTERN='^v?[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$'
SHORT_SHA_LENGTH=7
DISPATCH_MOVING_TAG='edge'
PRERELEASE_MOVING_TAG='beta'
STABLE_MOVING_TAG='latest'

join_tags() {
  local joined=''
  local tag
  for tag in "$@"; do
    joined="${joined:+$joined,}$IMAGE_REPO:$tag"
  done
  echo "$joined"
}

read_package_version() {
  sed -n 's/^[[:space:]]*"version": "\([^"]*\)".*/\1/p' package.json | head -n 1
}

EVENT_NAME="${EVENT_NAME:?EVENT_NAME is required}"
IMAGE_REPO="${IMAGE_REPO:?IMAGE_REPO is required}"
SHA="${SHA:?SHA is required}"

case "$EVENT_NAME" in
  workflow_dispatch)
    VERSION="$(read_package_version)"
    if [ -z "$VERSION" ]; then
      echo "could not read the version from package.json" >&2
      exit 1
    fi
    echo "version=$VERSION"
    echo "tags=$(join_tags "$DISPATCH_MOVING_TAG" "sha-${SHA:0:$SHORT_SHA_LENGTH}")"
    ;;
  release)
    RELEASE_TAG="${RELEASE_TAG:?RELEASE_TAG is required for a release event}"
    IS_PRERELEASE="${IS_PRERELEASE:?IS_PRERELEASE is required for a release event}"

    if [[ ! "$RELEASE_TAG" =~ $SEMVER_TAG_PATTERN ]]; then
      echo "release tag '$RELEASE_TAG' is not a SemVer tag" >&2
      exit 1
    fi

    VERSION="${RELEASE_TAG#v}"

    if [ "$IS_PRERELEASE" = "true" ]; then
      echo "version=$VERSION"
      echo "tags=$(join_tags "$VERSION" "$PRERELEASE_MOVING_TAG")"
    else
      echo "version=$VERSION"
      echo "tags=$(join_tags "$VERSION" "${VERSION%.*}" "$STABLE_MOVING_TAG")"
    fi
    ;;
  *)
    echo "unsupported event '$EVENT_NAME'" >&2
    exit 1
    ;;
esac

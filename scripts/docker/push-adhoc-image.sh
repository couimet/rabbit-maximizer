#!/usr/bin/env bash
# Build an image from the working tree and push it under a tag of its own, so an
# operator can test an evolution that is not ready for a release.
#
# The tag carries the commit and a UTC timestamp. The commit alone does not
# identify the build: the working tree usually holds changes the commit does
# not, and one commit produces many builds while the operator iterates. The
# timestamp separates those builds, so a new push never replaces an image that
# is still in use.
#
# A single-platform build loads into the local store and pushes after, so a
# refused push leaves the image behind for a second attempt. The docker exporter
# refuses a manifest list, so 'both' pushes during the build and keeps nothing
# locally.
#
# Usage: push-adhoc-image.sh <target>
#
#   amd64   build for Intel and AMD hosts
#   arm64   build for ARM hosts
#   both    build for both, as one manifest list
#
# Environment:
#   IMAGE_REPO   registry and repository, for example ghcr.io/couimet/rabbit-maximizer
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

IMAGE_REPO="${IMAGE_REPO:-ghcr.io/couimet/rabbit-maximizer}"
SHORT_SHA_LENGTH=7
TIMESTAMP_FORMAT='+%Y%m%d-%H%M%S'

usage() {
  echo 'Usage: push-adhoc-image.sh <target>' >&2
  echo '  amd64   build for Intel and AMD hosts' >&2
  echo '  arm64   build for ARM hosts' >&2
  echo '  both    build for both, as one manifest list' >&2
}

if [ $# -ne 1 ]; then
  usage
  exit 1
fi

TARGET="$1"

case "$TARGET" in
  amd64) PLATFORM='linux/amd64' ;;
  arm64) PLATFORM='linux/arm64' ;;
  both) PLATFORM='linux/amd64,linux/arm64' ;;
  *)
    echo "Unknown target '$TARGET'" >&2
    usage
    exit 1
    ;;
esac

if [ "$TARGET" = 'both' ]; then
  EXPORT_FLAG='--push'
else
  EXPORT_FLAG='--load'
fi

cd "$PROJECT_ROOT"

COMMIT_SHA="$(git rev-parse HEAD)"
SHORT_SHA="${COMMIT_SHA:0:$SHORT_SHA_LENGTH}"
IMAGE_REF="$IMAGE_REPO:$SHORT_SHA-$(date -u "$TIMESTAMP_FORMAT")"

if [ -n "$(git status --porcelain)" ]; then
  echo "The working tree holds changes that commit $SHORT_SHA does not. The image holds the working tree."
fi

# GIT_SHA and IMAGE_TAGS give the running container its identity, exactly as the
# publish workflow does.
if ! docker build \
  "$EXPORT_FLAG" \
  --platform "$PLATFORM" \
  --build-arg "GIT_SHA=$COMMIT_SHA" \
  --build-arg "IMAGE_TAGS=$IMAGE_REF" \
  --tag "$IMAGE_REF" \
  "$PROJECT_ROOT"; then
  if [ "$EXPORT_FLAG" = '--push' ]; then
    echo "The build stopped at its push. Run 'docker login ghcr.io' with a token that carries the write:packages scope, then build again:" >&2
    echo "  pnpm docker:push:adhoc:both" >&2
  fi
  exit 1
fi

# A refused push leaves the image in the local store, so the operator logs in and
# pushes that image again without a second build.
if [ "$EXPORT_FLAG" = '--load' ] && ! docker push "$IMAGE_REF"; then
  echo "The registry refused the push. Run 'docker login ghcr.io' with a token that carries the write:packages scope, then push the local image again:" >&2
  echo "  docker push $IMAGE_REF" >&2
  exit 1
fi

echo "Pushed $IMAGE_REF for $PLATFORM"
echo "On the other machine, run: docker pull $IMAGE_REF"

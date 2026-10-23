#!/usr/bin/env bash
# Lock the next stable version. The script sets the version in package.json and in
# the API spec, renames the changelog's Unreleased section to the version, and
# points the version's reference link at the tag that the release creates.
#
# Usage: lock-version.sh <X.Y.Z>
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

SEMVER_STABLE_PATTERN='^[0-9]+\.[0-9]+\.[0-9]+$'
SEMVER_PRERELEASE_PATTERN='^[0-9]+\.[0-9]+\.[0-9]+-[0-9A-Za-z.]+$'
CHANGELOG_BASE_URL='https://github.com/couimet/rabbit-maximizer'
UNRELEASED_HEADING='## [Unreleased]'
UNRELEASED_LINK='[Unreleased]:'
PACKAGE_FILE="$PROJECT_ROOT/package.json"
API_SPEC_FILE="$PROJECT_ROOT/docs/api-spec.yaml"
CHANGELOG_FILE="$PROJECT_ROOT/CHANGELOG.md"

git_in_project() {
  (cd "$PROJECT_ROOT" && git "$@")
}

read_package_version() {
  sed -n 's/^[[:space:]]*"version": "\([^"]*\)".*/\1/p' "$PACKAGE_FILE" | head -n 1
}

find_line_number() {
  local file="$1"
  local pattern="$2"
  local line_number
  line_number="$(grep -n -F -m 1 -- "$pattern" "$file" | cut -d: -f1 || true)"
  printf '%s\n' "$line_number"
}

# The tag the release creates is excluded, so a second run against the same
# version reports the tag before it, and not the tag itself.
previous_release_tag() {
  local locked_tag="v$1"
  local tag
  while IFS= read -r tag; do
    if [ "$tag" != "$locked_tag" ]; then
      printf '%s\n' "$tag"
      return 0
    fi
  done < <(git_in_project tag --list 'v*' --sort=-v:refname)
  printf '\n'
}

if [ $# -ne 1 ]; then
  echo "Usage: lock-version.sh <X.Y.Z>" >&2
  exit 1
fi

VERSION="$1"

if [[ "$VERSION" =~ $SEMVER_PRERELEASE_PATTERN ]]; then
  echo "Version '$VERSION' is a prerelease. Write a beta section by hand; this script locks stable versions only." >&2
  exit 1
fi

if [[ ! "$VERSION" =~ $SEMVER_STABLE_PATTERN ]]; then
  echo "Version '$VERSION' is not a SemVer version" >&2
  exit 1
fi

# Every file is checked before the first edit, so a missing file leaves no
# half-locked tree behind.
for required_file in "$PACKAGE_FILE" "$API_SPEC_FILE" "$CHANGELOG_FILE"; do
  if [ ! -f "$required_file" ]; then
    echo "Required file not found: $required_file" >&2
    exit 1
  fi
done

# A repeat run finds every edit already applied and stops before the dirty-tree
# check, because the run that applied the edits left the tree dirty.
if [ "$(read_package_version)" = "$VERSION" ] \
  && ! grep -q -F -- "$UNRELEASED_HEADING" "$CHANGELOG_FILE" \
  && ! grep -q -F -- "$UNRELEASED_LINK" "$CHANGELOG_FILE"; then
  echo "Version $VERSION is already locked; nothing changed."
  exit 0
fi

if ! git_in_project rev-parse --is-inside-work-tree > /dev/null 2>&1; then
  echo "$PROJECT_ROOT is not a git working tree" >&2
  exit 1
fi

if [ -n "$(git_in_project status --porcelain)" ]; then
  echo "Working tree is dirty; commit the pending changes first" >&2
  exit 1
fi

HEADING_LINE="$(find_line_number "$CHANGELOG_FILE" "$UNRELEASED_HEADING")"
LINK_LINE="$(find_line_number "$CHANGELOG_FILE" "$UNRELEASED_LINK")"

if [ -z "$HEADING_LINE" ]; then
  echo "CHANGELOG.md holds no '$UNRELEASED_HEADING' heading to rename" >&2
  exit 1
fi

if [ -z "$LINK_LINE" ]; then
  echo "CHANGELOG.md holds no '$UNRELEASED_LINK' reference link to rewrite" >&2
  exit 1
fi

TODAY="$(date -u +%Y-%m-%d)"
PREVIOUS_TAG="$(previous_release_tag "$VERSION")"

if [ -n "$PREVIOUS_TAG" ]; then
  RELEASE_URL="$CHANGELOG_BASE_URL/compare/$PREVIOUS_TAG...v$VERSION"
else
  RELEASE_URL="$CHANGELOG_BASE_URL/releases/tag/v$VERSION"
fi

CHANGELOG_TMP="$CHANGELOG_FILE.$$.lock-version"
sed -e "${HEADING_LINE}s|.*|## [$VERSION] - $TODAY|" \
  -e "${LINK_LINE}s|.*|[$VERSION]: $RELEASE_URL|" \
  "$CHANGELOG_FILE" > "$CHANGELOG_TMP"
mv -f "$CHANGELOG_TMP" "$CHANGELOG_FILE"

PACKAGE_TMP="$PACKAGE_FILE.$$.lock-version"
sed "s|^\([[:space:]]*\"version\": \"\)[^\"]*\"|\1$VERSION\"|" "$PACKAGE_FILE" > "$PACKAGE_TMP"
mv -f "$PACKAGE_TMP" "$PACKAGE_FILE"

API_SPEC_TMP="$API_SPEC_FILE.$$.lock-version"
sed "s|^\(  version: '\)[^']*'|\1$VERSION'|" "$API_SPEC_FILE" > "$API_SPEC_TMP"
mv -f "$API_SPEC_TMP" "$API_SPEC_FILE"

echo "Locked version $VERSION"
echo "  package.json        version $VERSION"
echo "  docs/api-spec.yaml  version $VERSION"
echo "  CHANGELOG.md        ## [$VERSION] - $TODAY"
echo "  reference link      $RELEASE_URL"
echo "Commit these changes, then run pnpm release:instructions."

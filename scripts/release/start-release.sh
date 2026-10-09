#!/usr/bin/env bash
# Reopen the changelog for the next release. The script adds a fresh Unreleased
# section above the newest version and restores the Unreleased reference link.
#
# Usage: start-release.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

CHANGELOG_BASE_URL='https://github.com/couimet/rabbit-maximizer'
UNRELEASED_HEADING='## [Unreleased]'
VERSION_HEADING_PREFIX='## ['
CHANGELOG_FILE="$PROJECT_ROOT/CHANGELOG.md"

git_in_project() {
  (cd "$PROJECT_ROOT" && git "$@")
}

# Matching a fixed string through case keeps the bracket in the heading and in
# the reference link literal, so no regular expression reads them as a set.
find_line_number() {
  local match="$1"
  local line
  local number=1
  while IFS= read -r line; do
    case "$line" in
      "$match"*) printf '%s\n' "$number"; return 0 ;;
    esac
    number=$((number + 1))
  done < "$CHANGELOG_FILE"
  printf '\n'
}

insert_before_line() {
  local number="$1"
  local text="$2"
  local tmp="$CHANGELOG_FILE.$$.start-release"
  {
    head -n "$((number - 1))" "$CHANGELOG_FILE"
    printf '%s\n' "$text"
    tail -n "+$number" "$CHANGELOG_FILE"
  } > "$tmp"
  mv -f "$tmp" "$CHANGELOG_FILE"
}

if [ $# -ne 0 ]; then
  echo "Usage: start-release.sh" >&2
  exit 1
fi

if [ ! -f "$CHANGELOG_FILE" ]; then
  echo "CHANGELOG.md not found at $CHANGELOG_FILE" >&2
  exit 1
fi

if grep -q -F -- "$UNRELEASED_HEADING" "$CHANGELOG_FILE"; then
  echo "CHANGELOG.md holds a '$UNRELEASED_HEADING' section already" >&2
  exit 1
fi

if ! git_in_project rev-parse --is-inside-work-tree > /dev/null 2>&1; then
  echo "$PROJECT_ROOT is not a git working tree" >&2
  exit 1
fi

if [ -n "$(git_in_project status --porcelain)" ]; then
  echo "Working tree is dirty; commit the pending changes first" >&2
  exit 1
fi

HEADING_LINE="$(find_line_number "$VERSION_HEADING_PREFIX")"

if [ -z "$HEADING_LINE" ]; then
  echo "CHANGELOG.md holds no '$VERSION_HEADING_PREFIX' heading to reopen above" >&2
  exit 1
fi

NEWEST_VERSION="$(sed -n "${HEADING_LINE}p" "$CHANGELOG_FILE" | cut -d'[' -f2 | cut -d']' -f1)"
LINK_LINE="$(find_line_number "[$NEWEST_VERSION]:")"

if [ -z "$LINK_LINE" ]; then
  echo "CHANGELOG.md holds no '[$NEWEST_VERSION]:' reference link to follow" >&2
  exit 1
fi

# The reference link goes in first, so the heading line number still counts the
# lines of the original file.
insert_before_line "$LINK_LINE" "[Unreleased]: $CHANGELOG_BASE_URL/compare/v$NEWEST_VERSION...HEAD"
insert_before_line "$HEADING_LINE" "$UNRELEASED_HEADING"$'\n'

echo "Reopened CHANGELOG.md for the next release"
echo "  newest version  $NEWEST_VERSION"
echo "  reference link  $CHANGELOG_BASE_URL/compare/v$NEWEST_VERSION...HEAD"
echo "Commit these changes before the next release."

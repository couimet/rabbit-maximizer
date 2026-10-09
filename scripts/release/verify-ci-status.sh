#!/usr/bin/env bash
# Refuse a release whose tagged commit did not pass its checks. The publish
# workflow runs this before the build, so a red commit never reaches the
# registry under a version tag.
#
# Environment:
#   REPOSITORY         owner and repository, for example couimet/rabbit-maximizer
#   COMMIT_SHA         commit that the release tag points at
#   POLL_INTERVAL_SEC  optional, seconds between two reads of the check runs
#   WAIT_TIMEOUT_SEC   optional, seconds to wait before the wait counts as a refusal
#
# gh reads its token from GH_TOKEN.
set -euo pipefail

POLL_INTERVAL_SEC="${POLL_INTERVAL_SEC:-15}"
WAIT_TIMEOUT_SEC="${WAIT_TIMEOUT_SEC:-600}"
PAGE_SIZE=100
COMPLETED_STATUS='completed'
PASSING_CONCLUSIONS='success neutral skipped'

# Matching a fixed string through case keeps every conclusion literal, so no
# regular expression reads the spaces of the list as a pattern.
conclusion_passed() {
  case " $PASSING_CONCLUSIONS " in
    *" $1 "*) return 0 ;;
  esac
  return 1
}

read_check_runs() {
  gh api "repos/$REPOSITORY/commits/$COMMIT_SHA/check-runs?per_page=$PAGE_SIZE" --paginate \
    --jq '.check_runs[] | [.status, (.conclusion // "none"), .name] | @tsv'
}

# An empty report keeps the wait going. A release starts seconds after the tag
# push, and the check runs of that commit may not exist yet at the first read.
must_keep_waiting() {
  local status
  local conclusion
  local name

  if [ -z "$1" ]; then
    return 0
  fi

  while IFS=$'\t' read -r status conclusion name; do
    if [ "$status" != "$COMPLETED_STATUS" ]; then
      return 0
    fi
  done <<< "$1"

  return 1
}

# Prints one line for each check run that did not pass, and reports whether any
# check run failed.
report_failures() {
  local status
  local conclusion
  local name
  local failures=0

  while IFS=$'\t' read -r status conclusion name; do
    if ! conclusion_passed "$conclusion"; then
      echo "check '$name' concluded '$conclusion'" >&2
      failures=$((failures + 1))
    fi
  done <<< "$1"

  [ "$failures" -eq 0 ]
}

REPOSITORY="${REPOSITORY:?REPOSITORY is required}"
COMMIT_SHA="${COMMIT_SHA:?COMMIT_SHA is required}"

ELAPSED_SEC=0
REPORT=''

while :; do
  REPORT="$(read_check_runs)"

  if ! must_keep_waiting "$REPORT"; then
    break
  fi

  if [ "$ELAPSED_SEC" -ge "$WAIT_TIMEOUT_SEC" ]; then
    if [ -z "$REPORT" ]; then
      echo "No check run covers $COMMIT_SHA after ${WAIT_TIMEOUT_SEC}s" >&2
    else
      echo "A check run on $COMMIT_SHA is unfinished after ${WAIT_TIMEOUT_SEC}s" >&2
    fi
    exit 1
  fi

  echo "Waiting ${POLL_INTERVAL_SEC}s for the check runs on $COMMIT_SHA" >&2
  sleep "$POLL_INTERVAL_SEC"
  ELAPSED_SEC=$((ELAPSED_SEC + POLL_INTERVAL_SEC))
done

if [ -z "$REPORT" ]; then
  echo "No check run covers $COMMIT_SHA, so the gate cannot confirm the commit passed" >&2
  exit 1
fi

if ! report_failures "$REPORT"; then
  echo "Refusing to publish $COMMIT_SHA" >&2
  exit 1
fi

echo "Every check run on $COMMIT_SHA passed"

#!/usr/bin/env bash
# Refuse a release whose tagged commit did not pass its checks. The publish
# workflow runs this before the build, so a red commit never reaches the
# registry under a version tag.
#
# Environment:
#   REPOSITORY              owner and repository, for example couimet/rabbit-maximizer
#   COMMIT_SHA              commit that the release tag points at
#   SELF_CHECK_NAME         check name of the calling job, which the gate ignores
#   SELF_RUN_ID             workflow run that holds the calling job
#   REQUIRED_WORKFLOW_FILE  workflow that must pass on the commit, for example ci.yml
#   POLL_INTERVAL_SEC       optional, seconds between two reads of the check runs
#   WAIT_TIMEOUT_SEC        optional, seconds to wait before the wait counts as a refusal
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

# The fourth field names the workflow run that owns the check run, read from the
# details URL: .../actions/runs/<run id>/job/<job id>. The check suite is not
# that identity, because one commit carries a suite per workflow.
read_check_runs() {
  gh api "repos/$REPOSITORY/commits/$COMMIT_SHA/check-runs?per_page=$PAGE_SIZE" --paginate \
    --jq '.check_runs[] | [.status, (.conclusion // "none"), .name, ((.details_url // "") | split("/") | .[-3] // "")] | @tsv'
}

# A run of the required workflow proves that CI itself ran on the commit. Every
# check run of the commit can come from another workflow, so a passing report
# alone does not say that CI passed.
read_required_workflow_runs() {
  gh api "repos/$REPOSITORY/actions/workflows/$REQUIRED_WORKFLOW_FILE/runs?head_sha=$COMMIT_SHA&per_page=$PAGE_SIZE" --paginate \
    --jq '.workflow_runs[] | [.status, (.conclusion // "none"), .id] | @tsv'
}

# The calling job owns one check run inside the run that runs this script, and
# that run stays in progress until the job ends. The gate drops that one run, or
# the wait would always end on the timeout of its own check. A check run of
# another workflow can carry the same name, and its result must still stop the
# release, so the name alone does not name the run to drop. An empty report
# stays empty, so the caller still tells a commit with no check run from one
# with a passing run.
drop_self_check_run() {
  local status
  local conclusion
  local name
  local run_id

  if [ -z "$1" ]; then
    return 0
  fi

  while IFS=$'\t' read -r status conclusion name run_id; do
    if [ "$name" != "$SELF_CHECK_NAME" ] || [ "$run_id" != "$SELF_RUN_ID" ]; then
      printf '%s\t%s\t%s\t%s\n' "$status" "$conclusion" "$name" "$run_id"
    fi
  done <<< "$1"
}

check_runs_unfinished() {
  local status
  local conclusion
  local name
  local run_id

  while IFS=$'\t' read -r status conclusion name run_id; do
    if [ "$status" != "$COMPLETED_STATUS" ]; then
      return 0
    fi
  done <<< "$1"

  return 1
}

# A run of the required workflow that already ended settles the evidence for
# that workflow, whatever it concluded. The wait covers the commit whose run has
# not appeared yet.
required_workflow_run_completed() {
  local status
  local conclusion
  local run_id

  if [ -z "$1" ]; then
    return 1
  fi

  while IFS=$'\t' read -r status conclusion run_id; do
    if [ "$status" = "$COMPLETED_STATUS" ]; then
      return 0
    fi
  done <<< "$1"

  return 1
}

# One run of the required workflow that concluded a passing result is the whole
# evidence the gate needs. A later run of the same workflow cannot take it back.
required_workflow_run_passed() {
  local status
  local conclusion
  local run_id

  while IFS=$'\t' read -r status conclusion run_id; do
    if [ "$status" = "$COMPLETED_STATUS" ] && conclusion_passed "$conclusion"; then
      return 0
    fi
  done <<< "$1"

  return 1
}

# An empty report keeps the wait going. A release starts seconds after the tag
# push, and the check runs of that commit may not exist yet at the first read.
# A commit with no completed run of the required workflow keeps it going too,
# because the same seconds also separate the tag push from the run of CI.
must_keep_waiting() {
  if [ -z "$1" ]; then
    return 0
  fi

  if check_runs_unfinished "$1"; then
    return 0
  fi

  if ! required_workflow_run_completed "$2"; then
    return 0
  fi

  return 1
}

# Prints one line for each check run that did not pass, and reports whether any
# check run failed.
report_failures() {
  local status
  local conclusion
  local name
  local run_id
  local failures=0

  while IFS=$'\t' read -r status conclusion name run_id; do
    if ! conclusion_passed "$conclusion"; then
      echo "check '$name' concluded '$conclusion'" >&2
      failures=$((failures + 1))
    fi
  done <<< "$1"

  [ "$failures" -eq 0 ]
}

REPOSITORY="${REPOSITORY:?REPOSITORY is required}"
COMMIT_SHA="${COMMIT_SHA:?COMMIT_SHA is required}"
SELF_CHECK_NAME="${SELF_CHECK_NAME:?SELF_CHECK_NAME is required}"
SELF_RUN_ID="${SELF_RUN_ID:?SELF_RUN_ID is required}"
REQUIRED_WORKFLOW_FILE="${REQUIRED_WORKFLOW_FILE:?REQUIRED_WORKFLOW_FILE is required}"

ELAPSED_SEC=0
REPORT=''
WORKFLOW_REPORT=''

while :; do
  REPORT="$(read_check_runs)"
  REPORT="$(drop_self_check_run "$REPORT")"
  WORKFLOW_REPORT="$(read_required_workflow_runs)"

  if ! must_keep_waiting "$REPORT" "$WORKFLOW_REPORT"; then
    break
  fi

  if [ "$ELAPSED_SEC" -ge "$WAIT_TIMEOUT_SEC" ]; then
    if [ -z "$REPORT" ]; then
      echo "No check run covers $COMMIT_SHA after ${WAIT_TIMEOUT_SEC}s" >&2
    elif check_runs_unfinished "$REPORT"; then
      echo "A check run on $COMMIT_SHA is unfinished after ${WAIT_TIMEOUT_SEC}s" >&2
    else
      echo "No completed run of $REQUIRED_WORKFLOW_FILE covers $COMMIT_SHA after ${WAIT_TIMEOUT_SEC}s" >&2
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

if ! required_workflow_run_passed "$WORKFLOW_REPORT"; then
  echo "No run of $REQUIRED_WORKFLOW_FILE on $COMMIT_SHA concluded a passing result, so the gate cannot confirm CI passed" >&2
  exit 1
fi

echo "Every check run on $COMMIT_SHA passed, and $REQUIRED_WORKFLOW_FILE concluded a passing result"

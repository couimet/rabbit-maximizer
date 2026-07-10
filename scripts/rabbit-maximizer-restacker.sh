#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ACTION_SCRIPT="$SCRIPT_DIR/../.github/actions/request-coderabbit-full-review/request-coderabbit-full-review.sh"

REPO="${1:-}"
MERGED_BRANCH="${2:-}"
MERGED_PR_NUMBER="${3:-}"

if [ -z "$REPO" ] || [ -z "$MERGED_BRANCH" ]; then
  echo "Usage: rabbit-maximizer-restacker.sh <repo> <merged-branch> [merged-pr-number]" >&2
  echo "Example: rabbit-maximizer-restacker.sh couimet/rabbit-maximizer feature/my-branch 42" >&2
  exit 1
fi

if ! command -v gh &> /dev/null; then
  echo "Error: gh CLI not found in PATH" >&2
  exit 1
fi

echo "Finding child PRs that had '$MERGED_BRANCH' as their base in $REPO..."

CHILD_PRS=$(gh pr list --base "$MERGED_BRANCH" --repo "$REPO" --state open --json number --jq '.[].number')

if [ -z "$CHILD_PRS" ]; then
  echo "No open child PRs found for merged branch '$MERGED_BRANCH'"
  exit 0
fi

# Save the real GITHUB_OUTPUT so we can write step outputs at the end.
# Each action invocation overrides GITHUB_OUTPUT to capture its comment-id.
REAL_GITHUB_OUTPUT="${GITHUB_OUTPUT:-/dev/null}"
METADATA="$(jq -n --arg merged_branch "$MERGED_BRANCH" '{merged_branch: $merged_branch}')"
CAPTURE_DIR="$(mktemp -d)"

CHILD_LINKS=""
FAILED_COUNT=0
for PR_NUMBER in $CHILD_PRS; do
  echo "Posting review trigger on child PR #$PR_NUMBER..."

  CAPTURE_FILE="$CAPTURE_DIR/pr-$PR_NUMBER.outputs"
  if PR_NUMBER="$PR_NUMBER" \
    REPO="$REPO" \
    TRIGGER="rabbit-maximizer-restacker" \
    METADATA="$METADATA" \
    GITHUB_OUTPUT="$CAPTURE_FILE" \
    bash "$ACTION_SCRIPT"; then
    COMMENT_ID=$(grep 'comment-id=' "$CAPTURE_FILE" 2>/dev/null | sed 's/comment-id=//' || echo "?")
    COMMENT_URL="https://github.com/$REPO/pull/$PR_NUMBER#issuecomment-$COMMENT_ID"
    CHILD_LINKS="${CHILD_LINKS}| #$PR_NUMBER | [review request]($COMMENT_URL) |
"
    echo "Posted review trigger on PR #$PR_NUMBER"
  else
    echo "Warning: Failed to post review trigger on PR #$PR_NUMBER" >&2
    CHILD_LINKS="${CHILD_LINKS}| #$PR_NUMBER | ⚠️ failed |
"
    FAILED_COUNT=$((FAILED_COUNT + 1))
  fi
done

rm -rf "$CAPTURE_DIR"

CHILD_COUNT=$(echo "$CHILD_PRS" | wc -l | tr -d ' ')
echo "Done. Triggered review on $CHILD_COUNT child PR(s)."

if [ -n "$MERGED_PR_NUMBER" ]; then
  SUMMARY_FILE="$(mktemp)"
  cat > "$SUMMARY_FILE" <<EOF
## rabbit-maximizer-restacker

Branch \`$MERGED_BRANCH\` merged. Requested CodeRabbit full review on $CHILD_COUNT child PR(s):

| Child PR | Review request |
|---|---|
$CHILD_LINKS
EOF
  if [ "$FAILED_COUNT" -gt 0 ]; then
    echo "_${FAILED_COUNT} review request(s) failed to post. See workflow logs for details._" >> "$SUMMARY_FILE"
  fi
  echo "summary-file=$SUMMARY_FILE" >> "$REAL_GITHUB_OUTPUT"
  echo "Summary written for merged PR #$MERGED_PR_NUMBER"
fi

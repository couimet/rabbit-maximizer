#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DB_PATH="$PROJECT_ROOT/data/rabbit-maximizer.db"

if ! command -v gh &> /dev/null; then
  echo "Error: gh CLI not found in PATH" >&2
  exit 1
fi

if ! command -v sqlite3 &> /dev/null; then
  echo "Error: sqlite3 not found in PATH" >&2
  exit 1
fi

if [ ! -f "$DB_PATH" ]; then
  echo "Error: Database not found at $DB_PATH" >&2
  exit 1
fi

echo "Querying PRs that need acknowledgement backfill..."

UNACKED=$(sqlite3 "$DB_PATH" "SELECT id, repo_full_name, pr_number, last_review_requested_at FROM pull_request WHERE last_review_requested_at IS NOT NULL AND last_coderabbit_acknowledged_at IS NULL")

if [ -z "$UNACKED" ]; then
  echo "No PRs found that need acknowledgement backfill."
  exit 0
fi

echo "Processing PRs..."
UPDATED_COUNT=0
TOTAL_COUNT=0

while IFS='|' read -r ID REPO PR_NUMBER REQUESTED_AT; do
  TOTAL_COUNT=$((TOTAL_COUNT + 1))
  echo ""
  echo "--- PR #$PR_NUMBER ($REPO) ---"

  COMMENT_JSON=""
  COMMENT_JSON=$(gh api "repos/$REPO/issues/$PR_NUMBER/comments?since=${REQUESTED_AT}&per_page=100" --jq '.[] | select(.user.login == "coderabbitai[bot]") | {created_at, body, html_url}' 2>/dev/null || true)

  if [ -z "$COMMENT_JSON" ]; then
    echo "  No CodeRabbit comments found since $REQUESTED_AT"
    continue
  fi

  MATCHED_AT=$(echo "$COMMENT_JSON" | jq -r 'select(.body | test("auto-generated reply by CodeRabbit")) | .created_at' 2>/dev/null | tail -1 || true)

  if [ -z "$MATCHED_AT" ]; then
    echo "  No acknowledgement comment found since $REQUESTED_AT"
    continue
  fi

  sqlite3 "$DB_PATH" "UPDATE pull_request SET last_coderabbit_acknowledged_at = '$MATCHED_AT' WHERE id = $ID"

  echo "  Updated last_coderabbit_acknowledged_at to $MATCHED_AT"
  UPDATED_COUNT=$((UPDATED_COUNT + 1))
done <<< "$UNACKED"

echo ""
echo "Done. Processed $TOTAL_COUNT PR(s), updated $UPDATED_COUNT acknowledgement(s)."

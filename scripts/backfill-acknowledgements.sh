#!/usr/bin/env bash
# Backfill last_coderabbit_acknowledged_at for PRs where we posted a retrigger
# but haven't recorded CodeRabbit's acknowledgement yet.
#
# The acknowledgement pattern is an auto-generated reply from CodeRabbit:
#   <!-- This is an auto-generated reply by CodeRabbit -->
#   @user: Sure, I'll perform a full review of all the changes in this PR again.
#
# Run via: bash scripts/backfill-acknowledgements.sh
#
# Requires: gh CLI authenticated, sqlite3, and the data-dir.sh script.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DB="$(bash "$SCRIPT_DIR/db/data-dir.sh")/rabbit-maximizer.db"

echo "=== Backfilling last_coderabbit_acknowledged_at ==="

# Fetch PRs where we requested a review but haven't recorded an acknowledgement.
# Sorted by most recent request first, limited to 30 PRs.
ROWS=$(sqlite3 "$DB" "
SELECT repo_full_name, pr_number, last_review_requested_at
FROM pull_request
WHERE last_review_requested_at IS NOT NULL
  AND last_coderabbit_acknowledged_at IS NULL
ORDER BY last_review_requested_at DESC
LIMIT 30;
")

if [ -z "$ROWS" ]; then
  echo "No PRs awaiting acknowledgement backfill."
  exit 0
fi

FOUND=0
MISSING=0

while IFS='|' read -r repo pr requested_at; do
  [ -z "$repo" ] && continue

  owner="${repo%/*}"
  repo_name="${repo#*/}"

  # Find the most recent CodeRabbit acknowledgement comment posted AFTER our retrigger.
  # The acknowledgement HTML comment distinguishes it from rate-limit and review comments.
  ACK_TS=$(gh api \
    -H "Accept: application/vnd.github.v3+json" \
    "/repos/$owner/$repo_name/issues/$pr/comments?sort=created&direction=desc&per_page=30" \
    --jq '.[] | select(.user.login == "coderabbitai[bot]") | select(.body | contains("<!-- This is an auto-generated reply by CodeRabbit -->")) | select(.created_at > "'"$requested_at"'") | .created_at' \
    2>/dev/null \
    | head -1)

  if [ -n "$ACK_TS" ]; then
    echo "  ✅ $repo#$pr — acknowledged at $ACK_TS (requested $requested_at)"
    sqlite3 "$DB" "
    UPDATE pull_request
    SET last_coderabbit_acknowledged_at = '$ACK_TS'
    WHERE repo_full_name = '$repo' AND pr_number = $pr;
    "
    FOUND=$((FOUND + 1))
  else
    echo "  ❌ $repo#$pr — no acknowledgement found (requested $requested_at)"
    MISSING=$((MISSING + 1))
  fi
done <<< "$ROWS"

echo ""
echo "=== Done: $FOUND backfilled, $MISSING still awaiting ==="

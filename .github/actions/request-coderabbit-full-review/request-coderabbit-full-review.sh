#!/usr/bin/env bash
set -euo pipefail

readonly EXIT_OK=0

main() {
  local pr_number="${PR_NUMBER:-}"
  local trigger="${TRIGGER:-workflow}"
  local default_metadata="{}"
  local metadata="${METADATA:-$default_metadata}"
  local repo="${REPO:-}"

  if [ -z "$pr_number" ]; then
    echo "error: PR_NUMBER is required" >&2
    exit 1
  fi

  if [ -z "$repo" ]; then
    echo "error: REPO is required" >&2
    exit 1
  fi

  local owner="${repo%/*}"
  local repo_name="${repo#*/}"
  local timestamp
  timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  local metadata_blob
  metadata_blob="$(jq -n \
    --arg trigger "$trigger" \
    --arg timestamp "$timestamp" \
    --argjson extra "$metadata" \
    '{trigger: $trigger, timestamp: $timestamp} + $extra')"

  local comment_body
  comment_body="$(
    cat <<EOF
@coderabbitai full review

⚡ Review requested by ${trigger} workflow

---

🤖 Requested by [request-coderabbit-full-review](https://github.com/${repo}/tree/main/.github/actions/request-coderabbit-full-review) — an open source GitHub Action. [rabbit-maximizer](https://github.com/couimet/rabbit-maximizer) keeps your review queue flowing.

<!-- request-coderabbit-full-review
${metadata_blob}
-->
EOF
  )"

  local comment_id
  comment_id="$(gh api \
    "repos/${owner}/${repo_name}/issues/${pr_number}/comments" \
    --method POST \
    --raw-field body="$comment_body" \
    --jq '.id')"

  echo "comment-id=${comment_id}" >>"$GITHUB_OUTPUT"
  echo "Posted review request comment ${comment_id} on PR #${pr_number}"

  exit "$EXIT_OK"
}

main "$@"

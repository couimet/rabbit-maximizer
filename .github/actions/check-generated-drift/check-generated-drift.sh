#!/usr/bin/env bash
set -euo pipefail

readonly EXIT_OK=0

main() {
  local command="${COMMAND:-}"

  if [ -z "$command" ]; then
    echo "error: COMMAND is required" >&2
    exit 1
  fi

  bash -euo pipefail -c "$command"

  if ! git diff --quiet; then
    local comment_file
    comment_file="$(mktemp)"

    {
      echo '## Generated drift detected'
      echo ''
      echo 'The following files are out of sync after running:'
      echo ''
      echo '```'
      echo "$command"
      echo '```'
      echo ''
      echo '### Drifted files'
      echo ''
      git diff --name-only | while read -r file; do
        echo "- \`$file\`"
      done
      echo ''
      echo 'Run the command locally and commit the result.'
    } > "$comment_file"

    echo "comment-file=$comment_file" >> "$GITHUB_OUTPUT"
  fi

  exit "$EXIT_OK"
}

main "$@"

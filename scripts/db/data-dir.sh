#!/usr/bin/env bash
# Output the absolute path to the shared data directory.
# Uses the main git repo root (not the worktree root) so the path is stable
# regardless of which worktree or nested worktree the command runs from.
#
# Override: set RABBIT_MAXIMIZER_DATA_DIR in the environment before calling.
set -euo pipefail

if [ -n "${RABBIT_MAXIMIZER_DATA_DIR:-}" ]; then
  echo "$RABBIT_MAXIMIZER_DATA_DIR"
  exit 0
fi

GIT_COMMON_DIR=$(git rev-parse --path-format=absolute --git-common-dir)
MAIN_REPO=$(dirname "$GIT_COMMON_DIR")
echo "$MAIN_REPO/data"

# Shared helpers for BATS action tests
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.github/actions/request-coderabbit-full-review" && pwd)"
export SCRIPT_DIR

setup() {
  cd "$BATS_TEST_TMPDIR" || return

  mkdir -p "$BATS_TEST_TMPDIR/bin"

  cat > "$BATS_TEST_TMPDIR/bin/gh" <<'MOCK_EOF'
#!/usr/bin/env bash
echo "$@" > "$MOCK_GH_ARGS_FILE"
echo '12345'
MOCK_EOF
  chmod +x "$BATS_TEST_TMPDIR/bin/gh"

  export PATH="$BATS_TEST_TMPDIR/bin:$PATH"
  export MOCK_GH_ARGS_FILE="$BATS_TEST_TMPDIR/gh-args.txt"
  export GITHUB_OUTPUT="$BATS_TEST_TMPDIR/github-output"
}

teardown() {
  :
}

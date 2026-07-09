#!/usr/bin/env bats

SCRIPT="$(dirname "$BATS_TEST_FILENAME")/../../scripts/rabbit-maximizer-restacker.sh"

setup() {
  TEST_TEMP_DIR="$(mktemp -d)"
  export TEST_TEMP_DIR

  mkdir -p "$TEST_TEMP_DIR/bin"
  export PATH="$TEST_TEMP_DIR/bin:$PATH"

  # Mock gh that reports no child PRs by default
  cat > "$TEST_TEMP_DIR/bin/gh" <<'MOCK'
#!/usr/bin/env bash
if [ "$1" = "pr" ] && [ "$2" = "list" ]; then
  echo ""
  exit 0
fi
echo "Unexpected gh call: $*" >&2
exit 1
MOCK
  chmod +x "$TEST_TEMP_DIR/bin/gh"

  cd "$TEST_TEMP_DIR"
}

teardown() {
  rm -rf "${TEST_TEMP_DIR:?}"
}

@test "no child PRs found -> exits 0, logs message" {
  run bash "$SCRIPT" "test-owner/test-repo" "merged-branch"
  [ "$status" -eq 0 ]
  [[ "$output" == *"No open child PRs found for merged branch 'merged-branch'"* ]]
}

@test "child PRs found -> posts comment for each via request-coderabbit-full-review action, exits 0" {
  cat > "$TEST_TEMP_DIR/bin/gh" <<'MOCK'
#!/usr/bin/env bash
if [ "$1" = "pr" ] && [ "$2" = "list" ]; then
  echo "42"
  echo "99"
  exit 0
fi
if [ "$1" = "api" ]; then
  echo "12345"
  exit 0
fi
echo "Unexpected gh call: $*" >&2
exit 1
MOCK

  run bash "$SCRIPT" "test-owner/test-repo" "feature-branch"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Posting review trigger on child PR #42"* ]]
  [[ "$output" == *"Posting review trigger on child PR #99"* ]]
  [[ "$output" == *"Posted review trigger on PR #42"* ]]
  [[ "$output" == *"Posted review trigger on PR #99"* ]]
  [[ "$output" == *"Triggered review on 2 child PR(s)"* ]]
}

@test "posted comment contains review command and action marker" {
  API_BODY_FILE="$TEST_TEMP_DIR/api-body.txt"

  cat > "$TEST_TEMP_DIR/bin/gh" <<MOCK
#!/usr/bin/env bash
if [ "\$1" = "pr" ] && [ "\$2" = "list" ]; then
  echo "7"
  exit 0
fi
if [ "\$1" = "api" ]; then
  while [ \$# -gt 0 ]; do
    case "\$1" in
      --field) echo "\$2" >> "$API_BODY_FILE"; shift 2 ;;
      *) shift ;;
    esac
  done
  echo "456"
  exit 0
fi
echo "Unexpected gh call: \$*" >&2
exit 1
MOCK

  run bash "$SCRIPT" "test-owner/test-repo" "feature-branch"
  [ "$status" -eq 0 ]
  grep -q "@coderabbitai full review" "$API_BODY_FILE"
  grep -q "request-coderabbit-full-review" "$API_BODY_FILE"
}

@test "missing repo argument -> exits non-zero with usage" {
  run bash "$SCRIPT" "" "some-branch"
  [ "$status" -ne 0 ]
  [[ "$output" == *"Usage:"* ]]
}

@test "missing branch argument -> exits non-zero with usage" {
  run bash "$SCRIPT" "test-owner/test-repo" ""
  [ "$status" -ne 0 ]
  [[ "$output" == *"Usage:"* ]]
}

@test "gh CLI not found -> exits non-zero with error" {
  command() {
    if [ "$1" = "-v" ] && [ "$2" = "gh" ]; then
      return 1
    fi
    builtin command "$@"
  }
  export -f command

  run bash "$SCRIPT" "test-owner/test-repo" "some-branch"
  [ "$status" -ne 0 ]
  [[ "$output" == *"gh CLI not found"* ]]
}

@test "gh pr list fails -> exits non-zero, error propagates" {
  cat > "$TEST_TEMP_DIR/bin/gh" <<'MOCK'
#!/usr/bin/env bash
if [ "$1" = "pr" ] && [ "$2" = "list" ]; then
  echo "gh: API error" >&2
  exit 1
fi
echo "Unexpected gh call: $*" >&2
exit 1
MOCK

  run bash "$SCRIPT" "test-owner/test-repo" "some-branch"
  [ "$status" -ne 0 ]
}

@test "merged PR number provided -> generates summary file and outputs summary-file to GITHUB_OUTPUT" {
  export GITHUB_OUTPUT="$TEST_TEMP_DIR/step-outputs"
  touch "$GITHUB_OUTPUT"

  cat > "$TEST_TEMP_DIR/bin/gh" <<'MOCK'
#!/usr/bin/env bash
if [ "$1" = "pr" ] && [ "$2" = "list" ]; then
  echo "42"
  exit 0
fi
if [ "$1" = "api" ]; then
  echo "99999"
  exit 0
fi
echo "Unexpected gh call: $*" >&2
exit 1
MOCK

  run bash "$SCRIPT" "test-owner/test-repo" "feature-branch" "136"
  [ "$status" -eq 0 ]

  # Step output references the summary file
  grep -q "summary-file=" "$GITHUB_OUTPUT"

  SUMMARY_FILE="$(grep 'summary-file=' "$GITHUB_OUTPUT" | sed 's/summary-file=//')"
  [ -f "$SUMMARY_FILE" ]

  # Summary content
  grep -q "rabbit-maximizer-restacker" "$SUMMARY_FILE"
  grep -q "feature-branch" "$SUMMARY_FILE"
  grep -q "#42" "$SUMMARY_FILE"
  grep -q "issuecomment-99999" "$SUMMARY_FILE"
  [[ "$output" == *"Summary written for merged PR #136"* ]]
}

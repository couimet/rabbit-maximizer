#!/usr/bin/env bats

load test_helper

@test "fails when PR_NUMBER is not set" {
  export REPO="couimet/rabbit-maximizer"
  unset PR_NUMBER
  run bash "$SCRIPT_DIR/request-coderabbit-full-review.sh"
  [ "$status" -eq 1 ]
  [[ "$output" == *"PR_NUMBER is required"* ]]
}

@test "fails when REPO is not set" {
  export PR_NUMBER="42"
  unset REPO
  run bash "$SCRIPT_DIR/request-coderabbit-full-review.sh"
  [ "$status" -eq 1 ]
  [[ "$output" == *"REPO is required"* ]]
}

@test "uses --raw-field (not --field) to prevent @ file-reference interpretation" {
  export PR_NUMBER="42"
  export REPO="couimet/rabbit-maximizer"
  run bash "$SCRIPT_DIR/request-coderabbit-full-review.sh"
  [ "$status" -eq 0 ]

  run grep 'raw-field body=' "$MOCK_GH_ARGS_FILE"
  [ "$status" -eq 0 ]

  run grep '\-\-field body=' "$MOCK_GH_ARGS_FILE"
  [ "$status" -ne 0 ]
}

@test "comment body starts with @coderabbitai full review mention" {
  export PR_NUMBER="42"
  export REPO="couimet/rabbit-maximizer"
  run bash "$SCRIPT_DIR/request-coderabbit-full-review.sh"
  [ "$status" -eq 0 ]

  run grep '@coderabbitai full review' "$MOCK_GH_ARGS_FILE"
  [ "$status" -eq 0 ]
}

@test "writes comment-id to GITHUB_OUTPUT" {
  export PR_NUMBER="42"
  export REPO="couimet/rabbit-maximizer"
  run bash "$SCRIPT_DIR/request-coderabbit-full-review.sh"
  [ "$status" -eq 0 ]

  run grep 'comment-id=12345' "$GITHUB_OUTPUT"
  [ "$status" -eq 0 ]
}

@test "prints success message to stdout" {
  export PR_NUMBER="42"
  export REPO="couimet/rabbit-maximizer"
  run bash "$SCRIPT_DIR/request-coderabbit-full-review.sh"
  [ "$status" -eq 0 ]

  [[ "$output" == *"Posted review request comment 12345 on PR #42"* ]]
}

@test "defaults TRIGGER to workflow when not set" {
  export PR_NUMBER="42"
  export REPO="couimet/rabbit-maximizer"
  unset TRIGGER
  run bash "$SCRIPT_DIR/request-coderabbit-full-review.sh"
  [ "$status" -eq 0 ]

  run grep 'trigger.*workflow' "$MOCK_GH_ARGS_FILE"
  [ "$status" -eq 0 ]
}

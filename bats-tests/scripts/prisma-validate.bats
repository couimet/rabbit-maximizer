#!/usr/bin/env bats

load test_helper

# Override setup() from test_helper — the validate script runs pnpm exec prettier
# which needs the project root, not BATS_TEST_TMPDIR.
setup() {
  cd "$PROJECT_ROOT" || return
}

teardown_file() {
  rm -rf "$PROJECT_ROOT/prisma/generated" 2>/dev/null || true
}

@test "exit 0 (PASS) when generated matches tracked snapshot" {
  mkdir -p prisma/generated
  echo "export type Foo = string" > prisma/generated/index.d.ts
  local generated
  generated="$(mktemp)"
  echo "export type Foo = string" > "$generated"

  PRISMA_VALIDATE_GENERATED="$generated" run bash "$SCRIPT_DIR/prisma-validate.sh"

  [ "$status" -eq 0 ]
  [[ "$output" == *"PASS: Prisma generated types match the tracked snapshot."* ]]
  rm -f "$generated"
}

@test "exit 1 (FAIL) when generated differs from tracked snapshot" {
  mkdir -p prisma/generated
  echo "export type Foo = string" > prisma/generated/index.d.ts
  local generated
  generated="$(mktemp)"
  echo "export type Bar = number" > "$generated"

  PRISMA_VALIDATE_GENERATED="$generated" run bash "$SCRIPT_DIR/prisma-validate.sh"

  [ "$status" -eq 1 ]
  [[ "$output" == *"FAIL: Prisma generated types are out of date."* ]]
  [[ "$output" == *"Run: pnpm prisma:snapshot"* ]]
  rm -f "$generated"
}

@test "exit 2 when tracked snapshot is missing" {
  rm -rf prisma/generated 2>/dev/null || true
  run bash "$SCRIPT_DIR/prisma-validate.sh"

  [ "$status" -eq 2 ]
  [[ "$output" == *"tracked snapshot not found"* ]]
  [[ "$output" == *"prisma:snapshot"* ]]
}

@test "exit 2 when generated client file does not exist" {
  mkdir -p prisma/generated
  echo "export type Foo = string" > prisma/generated/index.d.ts

  PRISMA_VALIDATE_GENERATED="/tmp/nonexistent-prisma-validate-fixture.d.ts" run bash "$SCRIPT_DIR/prisma-validate.sh"

  [ "$status" -eq 2 ]
  [[ "$output" == *"generated client not found"* ]]
}

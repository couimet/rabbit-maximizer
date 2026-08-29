#!/usr/bin/env bats

load test_helper

# All tests use PRISMA_VALIDATE_GENERATED and PRISMA_VALIDATE_TRACKED env vars
# to point at temp fixtures, avoiding any dependency on pnpm, prisma, or the
# real prisma/generated/ snapshot.

@test "exit 0 (PASS) when generated matches tracked snapshot" {
  local generated tracked
  generated="$(mktemp)"
  tracked="$(mktemp)"
  echo "export type Foo = string" > "$generated"
  echo "export type Foo = string" > "$tracked"

  PRISMA_VALIDATE_GENERATED="$generated" PRISMA_VALIDATE_TRACKED="$tracked" run bash "$SCRIPT_DIR/prisma-validate.sh"

  [ "$status" -eq 0 ]
  [[ "$output" == *"PASS: Prisma generated types match the tracked snapshot."* ]]
  rm -f "$generated" "$tracked"
}

@test "exit 1 (FAIL) when generated differs from tracked snapshot" {
  local generated tracked
  generated="$(mktemp)"
  tracked="$(mktemp)"
  echo "export type Bar = number" > "$generated"
  echo "export type Foo = string" > "$tracked"

  PRISMA_VALIDATE_GENERATED="$generated" PRISMA_VALIDATE_TRACKED="$tracked" run bash "$SCRIPT_DIR/prisma-validate.sh"

  [ "$status" -eq 1 ]
  [[ "$output" == *"FAIL: Prisma generated types are out of date."* ]]
  [[ "$output" == *"Run: pnpm prisma:snapshot"* ]]
  rm -f "$generated" "$tracked"
}

@test "exit 2 when tracked snapshot is missing" {
  PRISMA_VALIDATE_TRACKED="/tmp/nonexistent-prisma-validate-tracked.d.ts" run bash "$SCRIPT_DIR/prisma-validate.sh"

  [ "$status" -eq 2 ]
  [[ "$output" == *"tracked snapshot not found"* ]]
  [[ "$output" == *"prisma:snapshot"* ]]
}

@test "exit 2 when generated client file does not exist" {
  local tracked
  tracked="$(mktemp)"
  echo "export type Foo = string" > "$tracked"

  PRISMA_VALIDATE_GENERATED="/tmp/nonexistent-prisma-validate-fixture.d.ts" \
    PRISMA_VALIDATE_TRACKED="$tracked" run bash "$SCRIPT_DIR/prisma-validate.sh"

  [ "$status" -eq 2 ]
  [[ "$output" == *"generated client not found"* ]]
  rm -f "$tracked"
}

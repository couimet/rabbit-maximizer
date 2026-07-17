#!/usr/bin/env bats

load test_helper

@test "copies source file to prisma/generated/index.d.ts" {
  mkdir -p /tmp/fake-generated
  echo "export type Foo = { bar: string }" > /tmp/fake-generated/index.d.ts
  run bash "$SCRIPT_DIR/prisma-snapshot.sh" /tmp/fake-generated/index.d.ts
  [ "$status" -eq 0 ]
  [[ "$output" == *"Snapshot copied to prisma/generated/index.d.ts" ]]
  [ -f "prisma/generated/index.d.ts" ]
  result=$(cat prisma/generated/index.d.ts)
  [ "$result" = "export type Foo = { bar: string }" ]
  rm -rf /tmp/fake-generated
}

@test "creates output directory if missing" {
  mkdir -p /tmp/fake-generated
  echo "content" > /tmp/fake-generated/index.d.ts
  run bash "$SCRIPT_DIR/prisma-snapshot.sh" /tmp/fake-generated/index.d.ts
  [ "$status" -eq 0 ]
  [ -d "prisma/generated" ]
  rm -rf /tmp/fake-generated
}

@test "errors when source file does not exist" {
  run bash "$SCRIPT_DIR/prisma-snapshot.sh" /tmp/nonexistent/index.d.ts
  [ "$status" -eq 1 ]
  [[ "$output" == *"generated file not found"* ]]
}

@test "overwrites existing snapshot" {
  mkdir -p prisma/generated
  echo "old content" > prisma/generated/index.d.ts
  mkdir -p /tmp/fake-generated
  echo "new content" > /tmp/fake-generated/index.d.ts
  run bash "$SCRIPT_DIR/prisma-snapshot.sh" /tmp/fake-generated/index.d.ts
  [ "$status" -eq 0 ]
  result=$(cat prisma/generated/index.d.ts)
  [ "$result" = "new content" ]
  rm -rf /tmp/fake-generated
}

#!/usr/bin/env bats

load test_helper

setup() {
  cd "$BATS_TEST_TMPDIR" || return
  [ -d src ] && chmod -R 755 src 2>/dev/null || true
  [ -d tests ] && chmod -R 755 tests 2>/dev/null || true
  rm -rf prisma src tests
}

@test "passes when types/ files only have export interface and export type" {
  mkdir -p src/types
  echo "export interface Foo { bar: string }" > src/types/foo.ts
  echo "export type Bar = string" > src/types/bar.ts
  echo "export type { Baz } from './baz.js';" > src/types/baz.ts

  run bash "$SCRIPT_DIR/check-types-no-runtime.sh"

  [ "$status" -eq 0 ]
  [[ "$output" == *"OK: No runtime exports"* ]]
}

@test "fails when a types/ file has export enum" {
  mkdir -p src/types
  echo "export enum Color { Red, Green }" > src/types/color.ts

  run bash "$SCRIPT_DIR/check-types-no-runtime.sh"

  [ "$status" -eq 1 ]
  [[ "$output" == *"ERROR: Runtime exports found"* ]]
  [[ "$output" == *"export enum"* ]]
}

@test "fails when a types/ file has export const" {
  mkdir -p src/types
  echo "export const MEANING = 42;" > src/types/magic.ts

  run bash "$SCRIPT_DIR/check-types-no-runtime.sh"

  [ "$status" -eq 1 ]
  [[ "$output" == *"export const"* ]]
}

@test "fails when a types/ file has export class" {
  mkdir -p src/types
  echo "export class Widget {}" > src/types/widget.ts

  run bash "$SCRIPT_DIR/check-types-no-runtime.sh"

  [ "$status" -eq 1 ]
  [[ "$output" == *"export class"* ]]
}

@test "fails when a types/ file has export function" {
  mkdir -p src/types
  echo "export function greet() { return 'hi'; }" > src/types/greet.ts

  run bash "$SCRIPT_DIR/check-types-no-runtime.sh"

  [ "$status" -eq 1 ]
  [[ "$output" == *"export function"* ]]
}

@test "fails when a types/ file has export default" {
  mkdir -p src/types
  echo "export default class {}" > src/types/def.ts

  run bash "$SCRIPT_DIR/check-types-no-runtime.sh"

  [ "$status" -eq 1 ]
  [[ "$output" == *"export default"* ]]
}

@test "does not flag export type { ... } re-exports" {
  mkdir -p src/types
  echo "export type { Foo } from './foo.js';" > src/types/re-export.ts

  run bash "$SCRIPT_DIR/check-types-no-runtime.sh"

  [ "$status" -eq 0 ]
}

@test "does not flag inline type re-exports" {
  mkdir -p src/types
  echo "export { type Foo } from './foo.js';" > src/types/re-export.ts

  run bash "$SCRIPT_DIR/check-types-no-runtime.sh"

  [ "$status" -eq 0 ]
}

@test "checks nested types/ directories" {
  mkdir -p src/github/types
  echo "export enum State { Open, Closed }" > src/github/types/state.ts

  run bash "$SCRIPT_DIR/check-types-no-runtime.sh"

  [ "$status" -eq 1 ]
  [[ "$output" == *"export enum"* ]]
}

@test "succeeds when no types/ directories exist" {
  run bash "$SCRIPT_DIR/check-types-no-runtime.sh"

  [ "$status" -eq 0 ]
  [[ "$output" == *"No types/ files found"* ]]
}

@test "fails when a types/ file has a bare value re-export" {
  mkdir -p src/types
  echo "export { Foo } from './foo.js';" > src/types/re-export.ts

  run bash "$SCRIPT_DIR/check-types-no-runtime.sh"

  [ "$status" -eq 1 ]
  [[ "$output" == *"ERROR: Runtime exports found"* ]]
  [[ "$output" == *"export { Foo }"* ]]
}

@test "fails when a types/ file has a mixed re-export with runtime and type symbols" {
  mkdir -p src/types
  echo "export { Foo, type Bar } from './foo.js';" > src/types/re-export.ts

  run bash "$SCRIPT_DIR/check-types-no-runtime.sh"

  [ "$status" -eq 1 ]
  [[ "$output" == *"ERROR: Runtime exports found"* ]]
  [[ "$output" == *"export { Foo, type Bar }"* ]]
}

@test "fails on find error with non-zero exit" {
  mkdir -p src/types
  mkdir -p tests
  chmod 000 src

  run bash "$SCRIPT_DIR/check-types-no-runtime.sh"

  [ "$status" -eq 1 ]
  [[ "$output" == *"ERROR"* ]]

  chmod 755 src
}

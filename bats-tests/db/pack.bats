#!/usr/bin/env bats

load test_helper

SCRIPT="$SCRIPT_DIR/pack.sh"
ARCHIVE_NAME='rabbit-maximizer-data.tar.gz'

pack() {
  bash "$SCRIPT" "$@"
}

@test "writes an archive that holds the database at its root" {
  create_test_db
  local archive="$BATS_TEST_TMPDIR/$ARCHIVE_NAME"

  run pack "$archive"

  [ "$status" -eq 0 ]
  [ -f "$archive" ]
  [[ "$output" == *"Wrote the local database to $archive"* ]]
  [ "$(tar tzf "$archive")" = 'rabbit-maximizer.db' ]
}

@test "keeps every row of the database" {
  create_test_db
  local archive="$BATS_TEST_TMPDIR/$ARCHIVE_NAME"

  pack "$archive"
  mkdir -p "$BATS_TEST_TMPDIR/extracted"
  tar xzf "$archive" -C "$BATS_TEST_TMPDIR/extracted"

  [ "$(sqlite3 "$BATS_TEST_TMPDIR/extracted/rabbit-maximizer.db" "SELECT name FROM test_data WHERE id = 1;")" = 'hello' ]
}

@test "errors when the database does not exist" {
  run pack "$BATS_TEST_TMPDIR/$ARCHIVE_NAME"

  [ "$status" -eq 1 ]
  [[ "$output" == *'No database found at '* ]]
  [ ! -f "$BATS_TEST_TMPDIR/$ARCHIVE_NAME" ]
}

@test "refuses a directory that does not exist" {
  create_test_db

  run pack "$BATS_TEST_TMPDIR/missing/$ARCHIVE_NAME"

  [ "$status" -eq 1 ]
  [[ "$output" == *'Directory not found: '* ]]
}

@test "prints the usage when the file argument is missing" {
  create_test_db

  run pack

  [ "$status" -eq 1 ]
  [[ "$output" == *'Usage: pack.sh <file>'* ]]
}

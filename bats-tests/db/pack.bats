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

@test "refuses an archive path that names the live database" {
  local db_path
  db_path="$(create_test_db)"

  run pack "$db_path"

  [ "$status" -eq 1 ]
  [[ "$output" == *"The archive path names the live database: $db_path"* ]]
  [ "$(sqlite3 "$db_path" 'SELECT name FROM test_data WHERE id = 1;')" = 'hello' ]
}

@test "refuses a link that points at the live database" {
  local db_path link_path
  db_path="$(create_test_db)"
  link_path="$BATS_TEST_TMPDIR/$ARCHIVE_NAME"
  ln -s "$db_path" "$link_path"

  run pack "$link_path"

  [ "$status" -eq 1 ]
  [[ "$output" == *"The archive path names the live database: $link_path"* ]]
  [ "$(sqlite3 "$db_path" 'SELECT name FROM test_data WHERE id = 1;')" = 'hello' ]
}

@test "writes the archive readable by its owner only" {
  create_test_db
  local archive="$BATS_TEST_TMPDIR/$ARCHIVE_NAME"

  run pack "$archive"

  [ "$status" -eq 0 ]
  [ "$(stat -c '%a' "$archive" 2>/dev/null || stat -f '%Lp' "$archive")" = '600' ]
}

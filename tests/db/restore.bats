#!/usr/bin/env bats

load test_helper

setup() {
  cd "$BATS_TEST_TMPDIR"
  mkdir -p data/backups
}

@test "lists available backups with sizes when no argument" {
  create_test_db
  sqlite3 data/rabbit-maximizer.db .dump | gzip > data/backups/test-backup.sql.gz
  run bash "$SCRIPT_DIR/restore.sh"
  [ "$status" -eq 0 ]
  [[ "$output" =~ "Available backups:" ]]
  [[ "$output" =~ "test-backup.sql.gz" ]]
}

@test "lists nothing when backup directory is empty" {
  run bash "$SCRIPT_DIR/restore.sh"
  [ "$status" -eq 0 ]
  [[ "$output" =~ "No backups found" ]]
}

@test "creates pre-restore safety backup before restoring" {
  create_test_db
  local restore_from="$BATS_TEST_TMPDIR/restore-me.sql.gz"
  local source_db="$BATS_TEST_TMPDIR/source.db"
  sqlite3 "$source_db" "CREATE TABLE other_table (x INTEGER);"
  sqlite3 "$source_db" "INSERT INTO other_table VALUES (42);"
  sqlite3 "$source_db" .dump | gzip > "$restore_from"
  run bash -c "yes | bash '$SCRIPT_DIR/restore.sh' '$restore_from'"
  [ "$status" -eq 0 ]
  [[ "$output" =~ "Pre-restore backup:" ]]
  [[ "$output" =~ "Restored data/rabbit-maximizer.db" ]]
}

@test "restores from .sql.gz correctly" {
  create_test_db
  local restore_from="$BATS_TEST_TMPDIR/restore-me.sql.gz"
  local source_db="$BATS_TEST_TMPDIR/source.db"
  sqlite3 "$source_db" "CREATE TABLE restored_gz (id INTEGER PRIMARY KEY, val TEXT);"
  sqlite3 "$source_db" "INSERT INTO restored_gz VALUES (1, 'from-gz');"
  sqlite3 "$source_db" .dump | gzip > "$restore_from"
  run bash -c "yes | bash '$SCRIPT_DIR/restore.sh' '$restore_from'"
  [ "$status" -eq 0 ]
  assert_db_has_table data/rabbit-maximizer.db "restored_gz"
}

@test "restores from uncompressed .sql correctly" {
  create_test_db
  local restore_from="$BATS_TEST_TMPDIR/restore-me.sql"
  local source_db="$BATS_TEST_TMPDIR/source.db"
  sqlite3 "$source_db" "CREATE TABLE restored_sql (id INTEGER PRIMARY KEY, val TEXT);"
  sqlite3 "$source_db" "INSERT INTO restored_sql VALUES (1, 'from-sql');"
  sqlite3 "$source_db" .dump > "$restore_from"
  run bash -c "yes | bash '$SCRIPT_DIR/restore.sh' '$restore_from'"
  [ "$status" -eq 0 ]
  assert_db_has_table data/rabbit-maximizer.db "restored_sql"
}

@test "errors on missing backup file" {
  run bash "$SCRIPT_DIR/restore.sh" "/nonexistent/backup.sql.gz"
  [ "$status" -eq 1 ]
  [[ "$output" =~ "Backup file not found" ]]
}

@test "aborts on non-confirmation" {
  create_test_db
  local restore_from="$BATS_TEST_TMPDIR/restore-me.sql.gz"
  local source_db="$BATS_TEST_TMPDIR/source.db"
  sqlite3 "$source_db" "CREATE TABLE t (x INTEGER);"
  sqlite3 "$source_db" .dump | gzip > "$restore_from"
  run bash -c "echo 'n' | bash '$SCRIPT_DIR/restore.sh' '$restore_from'"
  [ "$status" -eq 0 ]
  [[ "$output" =~ "Aborted" ]]
}

@test "confirmation prompt matches expected format" {
  create_test_db
  local restore_from="$BATS_TEST_TMPDIR/restore-me.sql.gz"
  local source_db="$BATS_TEST_TMPDIR/source.db"
  sqlite3 "$source_db" "CREATE TABLE t (x INTEGER);"
  sqlite3 "$source_db" .dump | gzip > "$restore_from"
  run bash -c "echo 'y' | bash '$SCRIPT_DIR/restore.sh' '$restore_from'"
  [ "$status" -eq 0 ]
  [[ "$output" == *"About to replace data/rabbit-maximizer.db with $restore_from. Continue?"* ]]
}

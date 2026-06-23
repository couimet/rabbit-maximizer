#!/usr/bin/env bats

load test_helper

@test "creates compressed backup with timestamp filename" {
  create_test_db
  run bash "$SCRIPT_DIR/backup.sh"
  [ "$status" -eq 0 ]
  [[ "$output" =~ data/backups/[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]+Z\.sql\.gz ]]
  [ -f "$output" ]
}

@test "creates backup directory if missing" {
  rmdir "$BATS_TEST_TMPDIR/data/backups"
  create_test_db
  run bash "$SCRIPT_DIR/backup.sh"
  [ "$status" -eq 0 ]
  [ -d "$BATS_TEST_TMPDIR/data/backups" ]
  [ -f "$output" ]
}

@test "errors when database file does not exist" {
  run bash "$SCRIPT_DIR/backup.sh"
  [ "$status" -eq 1 ]
  [[ "$output" =~ "No database found at data/rabbit-maximizer.db" ]]
}

@test "rotates old backups keeping last 10" {
  create_test_db
  for i in $(seq 1 12); do
    sqlite3 "$BATS_TEST_TMPDIR/data/rabbit-maximizer.db" .dump | gzip > "$BATS_TEST_TMPDIR/data/backups/backup-$i.sql.gz"
    # Ensure distinct timestamps so ls -t sorts reliably
    sleep 0.1
  done
  run bash "$SCRIPT_DIR/backup.sh"
  [ "$status" -eq 0 ]
  local count
  count=$(ls "$BATS_TEST_TMPDIR/data/backups"/*.sql.gz | wc -l | tr -d ' ')
  [ "$count" -eq 10 ]  # rotation keeps exactly 10 most recent
}

@test "rotation is no-op when fewer than 10 backups exist" {
  create_test_db
  for i in $(seq 1 3); do
    sqlite3 "$BATS_TEST_TMPDIR/data/rabbit-maximizer.db" .dump | gzip > "$BATS_TEST_TMPDIR/data/backups/backup-$i.sql.gz"
  done
  run bash "$SCRIPT_DIR/backup.sh"
  [ "$status" -eq 0 ]
  local count
  count=$(ls "$BATS_TEST_TMPDIR/data/backups"/*.sql.gz | wc -l | tr -d ' ')
  [ "$count" -eq 4 ]  # 3 old + 1 new
}

@test "prints created backup path to stdout" {
  create_test_db
  run bash "$SCRIPT_DIR/backup.sh"
  [ "$status" -eq 0 ]
  [ -n "$output" ]
  [[ "$output" == "$BATS_TEST_TMPDIR/data/backups/"* ]]
}

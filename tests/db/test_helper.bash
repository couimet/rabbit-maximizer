# Shared helpers for BATS database tests
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../scripts/db" && pwd)"

setup() {
  cd "$BATS_TEST_TMPDIR"
  mkdir -p "data/backups"
}

teardown() {
  :
}

create_test_db() {
  local db_path="${1:-$BATS_TEST_TMPDIR/data/rabbit-maximizer.db}"
  sqlite3 "$db_path" "CREATE TABLE test_data (id INTEGER PRIMARY KEY, name TEXT);"
  sqlite3 "$db_path" "INSERT INTO test_data VALUES (1, 'hello');"
  echo "$db_path"
}

assert_db_has_table() {
  local db_path="$1"
  local table_name="$2"
  local result
  result=$(sqlite3 "$db_path" "SELECT name FROM sqlite_master WHERE type='table' AND name='$table_name';")
  if [ "$result" != "$table_name" ]; then
    echo "Expected table '$table_name' not found in $db_path" >&2
    return 1
  fi
}

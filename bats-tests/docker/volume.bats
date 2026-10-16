#!/usr/bin/env bats

load test_helper

# The script runs against a data directory and an archive on the local disk, so
# these tests exercise the real archive, extraction and owner logic. Only the
# chown call needs a stand-in, because a test does not run as root.

SCRIPT="$SCRIPT_DIR/docker/volume.sh"
DB_FILE_NAME='rabbit-maximizer.db'
DATA_UID='1001'
DATA_GID='1001'
STAGING_DIR_NAME='.restore'
PREVIOUS_DIR_NAME='.previous'
RESTORED_MARKER='restored'
CURRENT_MARKER='current'

setup() {
  DATA_DIR="$BATS_TEST_TMPDIR/data"
  SOURCE_DIR="$BATS_TEST_TMPDIR/source"
  ARCHIVE="$BATS_TEST_TMPDIR/volume.tar.gz"
  CHOWN_LOG="$BATS_TEST_TMPDIR/chown.log"
  BIN_DIR="$BATS_TEST_TMPDIR/bin"

  mkdir -p "$DATA_DIR" "$SOURCE_DIR" "$BIN_DIR"

  # A test does not run as root, so the real chown refuses. The stand-in
  # records the call, which is what these tests assert.
  cat > "$BIN_DIR/chown" <<'FAKE_CHOWN'
#!/usr/bin/env bash
echo "chown $*" >> "$CHOWN_LOG"
exit 0
FAKE_CHOWN
  chmod +x "$BIN_DIR/chown"
  export CHOWN_LOG
}

volume() {
  RABBIT_MAXIMIZER_DATA_DIR="$DATA_DIR" PATH="$BIN_DIR:$PATH" sh "$SCRIPT" "$@"
}

# The import reads the file header, so a payload must be a real SQLite
# database. A sentinel row then identifies which database the data directory
# holds after the run.
write_database() {
  sqlite3 "$1" "CREATE TABLE sentinel (marker TEXT); INSERT INTO sentinel VALUES ('$2');"
}

read_sentinel() {
  sqlite3 "$1" 'SELECT marker FROM sentinel;'
}

write_source_archive() {
  write_database "$SOURCE_DIR/$DB_FILE_NAME" "$RESTORED_MARKER"
  tar czf "$ARCHIVE" -C "$SOURCE_DIR" .
}

@test 'exports the data directory into a gzipped tar' {
  echo 'the database' > "$DATA_DIR/$DB_FILE_NAME"

  run volume export "$ARCHIVE"

  [ "$status" -eq 0 ]
  [[ "$output" == *"Wrote $DATA_DIR to $ARCHIVE"* ]]
  [ -f "$ARCHIVE" ]

  run tar tzf "$ARCHIVE"
  [[ "$output" == *"$DB_FILE_NAME"* ]]
}

@test 'restores the data directory from an archive' {
  write_source_archive
  write_database "$DATA_DIR/$DB_FILE_NAME" "$CURRENT_MARKER"

  run volume import "$ARCHIVE"

  [ "$status" -eq 0 ]
  [ "$(read_sentinel "$DATA_DIR/$DB_FILE_NAME")" = "$RESTORED_MARKER" ]
}

@test 'removes the contents the data directory held before the restore' {
  write_source_archive
  echo 'stale' > "$DATA_DIR/old.txt"

  run volume import "$ARCHIVE"

  [ "$status" -eq 0 ]
  [ ! -e "$DATA_DIR/old.txt" ]
}

@test 'sets the owner of the data directory after the restore' {
  write_source_archive

  run volume import "$ARCHIVE"

  [ "$status" -eq 0 ]
  [ "$(cat "$CHOWN_LOG")" = "chown -R $DATA_UID:$DATA_GID $DATA_DIR" ]
}

@test 'leaves no staging directory behind after a restore' {
  write_source_archive

  run volume import "$ARCHIVE"

  [ "$status" -eq 0 ]
  [ ! -e "$DATA_DIR/$STAGING_DIR_NAME" ]
  [ ! -e "$DATA_DIR/$PREVIOUS_DIR_NAME" ]
}

@test 'refuses an archive that holds no database and keeps the data directory' {
  echo 'notes' > "$SOURCE_DIR/notes.txt"
  tar czf "$ARCHIVE" -C "$SOURCE_DIR" .
  write_database "$DATA_DIR/$DB_FILE_NAME" "$CURRENT_MARKER"

  run volume import "$ARCHIVE"

  [ "$status" -eq 1 ]
  [[ "$output" == *"The archive holds no $DB_FILE_NAME"* ]]
  [ "$(read_sentinel "$DATA_DIR/$DB_FILE_NAME")" = "$CURRENT_MARKER" ]
  [ ! -e "$CHOWN_LOG" ]
}

@test 'refuses a database that is not a SQLite file and keeps the data directory' {
  echo 'notes, not a database' > "$SOURCE_DIR/$DB_FILE_NAME"
  tar czf "$ARCHIVE" -C "$SOURCE_DIR" .
  write_database "$DATA_DIR/$DB_FILE_NAME" "$CURRENT_MARKER"

  run volume import "$ARCHIVE"

  [ "$status" -eq 1 ]
  [[ "$output" == *"The archive holds a $DB_FILE_NAME that is not a SQLite database"* ]]
  [ "$(read_sentinel "$DATA_DIR/$DB_FILE_NAME")" = "$CURRENT_MARKER" ]
  [ ! -e "$CHOWN_LOG" ]
}

@test 'refuses a database that is a symbolic link and keeps the data directory' {
  # The link points at the database the data directory holds, so the header
  # check reads a real SQLite file unless the import refuses the link first.
  write_database "$DATA_DIR/$DB_FILE_NAME" "$CURRENT_MARKER"
  ln -s "$DATA_DIR/$DB_FILE_NAME" "$SOURCE_DIR/$DB_FILE_NAME"
  tar czf "$ARCHIVE" -C "$SOURCE_DIR" .

  run volume import "$ARCHIVE"

  [ "$status" -eq 1 ]
  [[ "$output" == *"The archive holds a $DB_FILE_NAME that is a symbolic link"* ]]
  [ "$(read_sentinel "$DATA_DIR/$DB_FILE_NAME")" = "$CURRENT_MARKER" ]
  [ ! -e "$CHOWN_LOG" ]
}

@test 'removes the staging directory a failed run left behind' {
  write_source_archive
  mkdir -p "$DATA_DIR/$STAGING_DIR_NAME"
  echo 'a partial payload' > "$DATA_DIR/$STAGING_DIR_NAME/$DB_FILE_NAME"

  run volume import "$ARCHIVE"

  [ "$status" -eq 0 ]
  [ ! -e "$DATA_DIR/$STAGING_DIR_NAME" ]
  [ ! -e "$DATA_DIR/$PREVIOUS_DIR_NAME" ]
}

@test 'refuses an import while the previous directory holds an earlier payload' {
  write_source_archive
  mkdir -p "$DATA_DIR/$PREVIOUS_DIR_NAME"
  echo 'a previous payload' > "$DATA_DIR/$PREVIOUS_DIR_NAME/$DB_FILE_NAME"

  run volume import "$ARCHIVE"

  [ "$status" -eq 1 ]
  [[ "$output" == *"An earlier import stopped between its two moves"* ]]
  [[ "$output" == *"Move the entries of $DATA_DIR/$PREVIOUS_DIR_NAME back into $DATA_DIR"* ]]
  [ -f "$DATA_DIR/$PREVIOUS_DIR_NAME/$DB_FILE_NAME" ]
  [ ! -e "$DATA_DIR/$DB_FILE_NAME" ]
  [ ! -e "$DATA_DIR/$STAGING_DIR_NAME" ]
  [ ! -e "$CHOWN_LOG" ]
}

@test 'refuses an archive that is not a tar' {
  echo 'not a tar' > "$ARCHIVE"
  write_database "$DATA_DIR/$DB_FILE_NAME" "$CURRENT_MARKER"

  run volume import "$ARCHIVE"

  [ "$status" -eq 1 ]
  [[ "$output" == *"The archive did not open: $ARCHIVE"* ]]
  [ "$(read_sentinel "$DATA_DIR/$DB_FILE_NAME")" = "$CURRENT_MARKER" ]
}

@test 'refuses an archive that does not exist' {
  run volume import "$BATS_TEST_TMPDIR/missing.tar.gz"

  [ "$status" -eq 1 ]
  [[ "$output" == *'Archive not found: '* ]]
}

@test 'leaves the staging directories out of an export' {
  echo 'the database' > "$DATA_DIR/$DB_FILE_NAME"
  mkdir -p "$DATA_DIR/$STAGING_DIR_NAME" "$DATA_DIR/$PREVIOUS_DIR_NAME"
  echo 'a partial payload' > "$DATA_DIR/$STAGING_DIR_NAME/$DB_FILE_NAME"
  echo 'a previous payload' > "$DATA_DIR/$PREVIOUS_DIR_NAME/$DB_FILE_NAME"

  run volume export "$ARCHIVE"

  [ "$status" -eq 0 ]
  run tar tzf "$ARCHIVE"
  [[ "$output" != *"$STAGING_DIR_NAME"* ]]
  [[ "$output" != *"$PREVIOUS_DIR_NAME"* ]]
  [[ "$output" == *"$DB_FILE_NAME"* ]]
}

@test 'refuses a data directory that does not exist' {
  DATA_DIR="$BATS_TEST_TMPDIR/missing"

  run volume export "$ARCHIVE"

  [ "$status" -eq 1 ]
  [[ "$output" == *"Data directory not found: $DATA_DIR"* ]]
}

@test 'prints the usage for an unknown subcommand' {
  run volume copy "$ARCHIVE"

  [ "$status" -eq 1 ]
  [[ "$output" == *"Unknown subcommand 'copy'"* ]]
  [[ "$output" == *'Usage: volume.sh export <archive>'* ]]
}

@test 'prints the usage when the archive argument is missing' {
  run volume export

  [ "$status" -eq 1 ]
  [[ "$output" == *'Usage: volume.sh export <archive>'* ]]
}

@test 'prints the usage when no argument is given' {
  run volume

  [ "$status" -eq 1 ]
  [[ "$output" == *'Usage: volume.sh export <archive>'* ]]
}

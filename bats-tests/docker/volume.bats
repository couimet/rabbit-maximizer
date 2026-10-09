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

write_source_archive() {
  echo 'restored database' > "$SOURCE_DIR/$DB_FILE_NAME"
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
  echo 'the current database' > "$DATA_DIR/$DB_FILE_NAME"

  run volume import "$ARCHIVE"

  [ "$status" -eq 0 ]
  [ "$(cat "$DATA_DIR/$DB_FILE_NAME")" = 'restored database' ]
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
  echo 'the current database' > "$DATA_DIR/$DB_FILE_NAME"

  run volume import "$ARCHIVE"

  [ "$status" -eq 1 ]
  [[ "$output" == *"The archive holds no $DB_FILE_NAME"* ]]
  [ "$(cat "$DATA_DIR/$DB_FILE_NAME")" = 'the current database' ]
  [ ! -e "$CHOWN_LOG" ]
}

@test 'removes the staging directory a failed run left behind' {
  echo 'notes' > "$SOURCE_DIR/notes.txt"
  tar czf "$ARCHIVE" -C "$SOURCE_DIR" .
  mkdir -p "$DATA_DIR/$STAGING_DIR_NAME" "$DATA_DIR/$PREVIOUS_DIR_NAME"
  echo 'a partial payload' > "$DATA_DIR/$STAGING_DIR_NAME/$DB_FILE_NAME"
  echo 'a previous payload' > "$DATA_DIR/$PREVIOUS_DIR_NAME/$DB_FILE_NAME"

  run volume import "$ARCHIVE"

  [ "$status" -eq 1 ]
  [ ! -e "$DATA_DIR/$STAGING_DIR_NAME" ]
  [ ! -e "$DATA_DIR/$PREVIOUS_DIR_NAME" ]
}

@test 'refuses an archive that is not a tar' {
  echo 'not a tar' > "$ARCHIVE"
  echo 'the current database' > "$DATA_DIR/$DB_FILE_NAME"

  run volume import "$ARCHIVE"

  [ "$status" -eq 1 ]
  [[ "$output" == *"The archive did not open: $ARCHIVE"* ]]
  [ "$(cat "$DATA_DIR/$DB_FILE_NAME")" = 'the current database' ]
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

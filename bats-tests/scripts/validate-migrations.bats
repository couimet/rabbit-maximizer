#!/usr/bin/env bats

load test_helper

# The script calls `pnpm prisma migrate deploy`. Tests mock `pnpm` via PATH
# to avoid depending on the full Node.js/Prisma toolchain.

fake_pnpm() {
  local bindir exit_code
  bindir="$(mktemp -d)"
  exit_code="${1:-0}"

  cat > "$bindir/pnpm" <<EOF
#!/usr/bin/env bash
[ "\$1" = "prisma" ] && [ "\$2" = "migrate" ] && [ "\$3" = "deploy" ] || { echo "unexpected args: \$*" >&2; exit 99; }
db_path="\${DATABASE_URL#file:}"
touch "\$db_path"
echo "FAKE_DB_PATH=\$db_path"
exit $exit_code
EOF
  chmod +x "$bindir/pnpm"

  echo "$bindir"
}

@test "exit 0 (PASS) when all migrations apply successfully" {
  local bindir
  bindir="$(fake_pnpm 0)"

  PATH="$bindir:$PATH" run bash "$SCRIPT_DIR/validate-migrations.sh"

  [ "$status" -eq 0 ]
  [[ "$output" == *"PASS: All migrations applied successfully."* ]]
  rm -rf "$bindir"
}

@test "exits with prisma error code when migration fails" {
  local bindir
  bindir="$(fake_pnpm 1)"

  PATH="$bindir:$PATH" run bash "$SCRIPT_DIR/validate-migrations.sh"

  [ "$status" -eq 1 ]
  [[ "$output" != *"PASS"* ]]
  rm -rf "$bindir"
}

@test "calls prisma migrate deploy" {
  local bindir
  bindir="$(fake_pnpm 0)"

  PATH="$bindir:$PATH" run bash "$SCRIPT_DIR/validate-migrations.sh"

  [ "$status" -eq 0 ]
  rm -rf "$bindir"
}

@test "cleans up temp directory on success" {
  local bindir db_path
  bindir="$(fake_pnpm 0)"

  PATH="$bindir:$PATH" run bash "$SCRIPT_DIR/validate-migrations.sh"

  [ "$status" -eq 0 ]
  db_path="$(sed -n 's/^FAKE_DB_PATH=//p' <<<"$output")"
  [ -n "$db_path" ]
  [ ! -e "$db_path" ]
  [ ! -d "$(dirname "$db_path")" ]
  rm -rf "$bindir"
}

@test "cleans up temp directory on failure" {
  local bindir db_path
  bindir="$(fake_pnpm 1)"

  PATH="$bindir:$PATH" run bash "$SCRIPT_DIR/validate-migrations.sh"

  [ "$status" -eq 1 ]
  db_path="$(sed -n 's/^FAKE_DB_PATH=//p' <<<"$output")"
  [ -n "$db_path" ]
  [ ! -e "$db_path" ]
  [ ! -d "$(dirname "$db_path")" ]
  rm -rf "$bindir"
}

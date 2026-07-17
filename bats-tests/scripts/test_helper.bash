SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../scripts" && pwd)"
export SCRIPT_DIR

setup() {
  cd "$BATS_TEST_TMPDIR" || return
  rm -rf prisma
}

teardown() {
  :
}

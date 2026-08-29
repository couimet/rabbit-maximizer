SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../scripts" && pwd)"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export SCRIPT_DIR PROJECT_ROOT

setup() {
  cd "$BATS_TEST_TMPDIR" || return
  rm -rf prisma
}

teardown() {
  :
}

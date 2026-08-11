#!/usr/bin/env bash
set -euo pipefail

# Apply all Prisma migrations to a fresh temporary SQLite database and report
# success or failure. Catches unmapped table names, syntax errors, and other
# SQL issues that Prisma's migration engine rejects.
#
# Usage: validate-migrations.sh

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

export DATABASE_URL="file:${TMPDIR}/rabbit-maximizer.db"

echo "Validating all migrations against a fresh SQLite database..."

pnpm prisma migrate deploy

echo "PASS: All migrations applied successfully."

#!/usr/bin/env bash
# Runs the RLS policy assertions against the verification database.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/db.sh
. "$ROOT/scripts/lib/db.sh"

DB="${VERIFY_DB:-elvt_verify}"

require_db
psql_db "$DB" -f "$ROOT/tests/sql/rls_checks.sql"

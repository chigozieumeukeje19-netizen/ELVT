#!/usr/bin/env bash
# One assertion per client API endpoint, run against the verification database.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/db.sh
. "$ROOT/scripts/lib/db.sh"

DB="${VERIFY_DB:-elvt_verify}"

require_db
psql_db "$DB" -f "$ROOT/tests/sql/api_rls_checks.sql"

#!/usr/bin/env bash
# Asserts the local stand-in matches the real Supabase schema where it matters,
# then prints every generated column for the cross check in the unit test.
set -euo pipefail
HOST="${PGHOST:-127.0.0.1}"
PORT="${PGPORT:-5433}"
USER="${PGUSER:-postgres}"
DB="${VERIFY_DB:-elvt_verify}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# psql sends RAISE NOTICE to stderr. Merged so a caller reading stdout sees the
# assertions as well as the generated column list.
psql -v ON_ERROR_STOP=1 -h "$HOST" -p "$PORT" -U "$USER" -d "$DB" \
  -f "$ROOT/tests/sql/shim_conformance.sql" 2>&1

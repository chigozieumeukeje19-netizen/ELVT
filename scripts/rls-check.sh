#!/usr/bin/env bash
set -euo pipefail
HOST="${PGHOST:-127.0.0.1}"
PORT="${PGPORT:-5433}"
USER="${PGUSER:-postgres}"
DB="${VERIFY_DB:-elvt_verify}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
psql -v ON_ERROR_STOP=1 -h "$HOST" -p "$PORT" -U "$USER" -d "$DB" -f "$ROOT/tests/sql/rls_checks.sql"

#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Checks the assumptions the local shim encodes about the Supabase auth schema.
#
# Where it runs matters. When the real auth schema is reachable, this runs
# against THAT, so the assertions are checked against production rather than
# against the shim restating itself. That is the only version of this check
# worth much: a shim graded by its own copy of the answer is how
# auth.identities.email got through in the first place.
#
# On a machine with no Supabase it falls back to the verification database,
# where the shim is all there is, and says so.
# ---------------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/db.sh
. "$ROOT/scripts/lib/db.sh"

require_db

REAL_DB="$(db_default_name)"
VERIFY="${VERIFY_DB:-elvt_verify}"

has_real_auth() {
  local found
  found="$(psql "$(db_url_for "$REAL_DB")" -Atc \
    "select count(*) from information_schema.tables
      where table_schema = 'auth' and table_name = 'identities'" 2>/dev/null || echo 0)"
  [ "$found" = "1" ]
}

if has_real_auth; then
  TARGET="$REAL_DB"
  echo "SOURCE: real auth schema ($(db_display))"
else
  TARGET="$VERIFY"
  echo "SOURCE: shim (no real auth schema on this server)"
fi

# Named so a caller can query the same schema these assertions just graded.
echo "TARGET_DB: $TARGET"

# psql sends RAISE NOTICE to stderr. Merged so a caller reading stdout sees the
# assertions as well as the generated column list.
psql -v ON_ERROR_STOP=1 "$(db_url_for "$TARGET")" \
  -f "$ROOT/tests/sql/shim_conformance.sql" 2>&1

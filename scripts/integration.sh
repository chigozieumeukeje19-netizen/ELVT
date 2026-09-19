#!/usr/bin/env bash
# The integration suite: real PostgREST, real rows.
#
# Finds PostgREST one of two ways and says which one it used. With neither, it
# FAILS and names both, because a persistence test that quietly does not run
# reports a layer as covered that nothing has ever exercised.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/db.sh
. "$ROOT/scripts/lib/db.sh"
# shellcheck source=scripts/lib/env.sh
. "$ROOT/scripts/lib/env.sh"

load_env_file "$ROOT" || true

DB="${INTEGRATION_DB:-elvt_rest}"
PORT="${INTEGRATION_REST_PORT:-3011}"
PGRST_PID=""

cleanup() {
  if [ -n "$PGRST_PID" ]; then
    kill "$PGRST_PID" 2>/dev/null || true
    wait "$PGRST_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# --- 1. A running Supabase stack, which is the real thing -------------------
SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-}"
if [ -n "$SUPABASE_URL" ] && curl -fsS -o /dev/null --max-time 3 "$SUPABASE_URL/rest/v1/" 2>/dev/null; then
  echo "PostgREST: the running Supabase stack at $SUPABASE_URL"
  export ELVT_REST_URL="$SUPABASE_URL"
  export ELVT_REST_KIND="supabase"
  export ELVT_REST_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
  export ELVT_REST_DB_URL="$ELVT_DB_URL"
  exec npx vitest run --config vitest.integration.mts "$@"
fi

# --- 2. A bare PostgREST binary against a throwaway database ----------------
PGRST="${POSTGREST_BIN:-$(command -v postgrest || true)}"

if [ -z "$PGRST" ] || [ ! -x "$PGRST" ]; then
  cat >&2 <<'MSG'

No PostgREST, so the integration tests cannot run.

They are the only tests that prove the queries behind the week roll, the
trigger engine, the Monday cards, the dispatchers and the photo gallery
read the right rows. This is a failure rather than a skip: skipping would
report those layers as covered when nothing has exercised them.

Either start the real stack:

  supabase start
  npm run test:integration

or point POSTGREST_BIN at a binary, and this script builds its own
database from the migrations and the seed:

  POSTGREST_BIN=/usr/local/bin/postgrest npm run test:integration

Downloads: https://github.com/PostgREST/postgrest/releases

MSG
  exit 1
fi

require_db

if [ -z "${SUPABASE_JWT_SECRET:-}" ]; then
  echo >&2 "SUPABASE_JWT_SECRET is not set, so no token can be signed for PostgREST."
  exit 1
fi

require_free_ports "$PORT"

echo "PostgREST: $PGRST against a throwaway $DB"
VERIFY_DB="$DB" bash "$ROOT/scripts/verify-migrations.sh" > /dev/null

CONF="$(mktemp)"
cat > "$CONF" <<EOF
db-uri = "$(db_url_for "$DB")"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$SUPABASE_JWT_SECRET"
server-port = $PORT
db-pool = 4
EOF

"$PGRST" "$CONF" > /tmp/elvt-postgrest.log 2>&1 &
PGRST_PID=$!

# Wait for it to answer rather than sleeping a guess. A 401 is an answer: it
# means the server is up and RLS is on.
for attempt in $(seq 1 40); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/clients" || true)"
  if [ "$code" != "000" ] && [ -n "$code" ]; then
    break
  fi
  if [ "$attempt" -eq 40 ]; then
    echo >&2 "PostgREST did not start. Its log:"
    tail -20 /tmp/elvt-postgrest.log >&2
    exit 1
  fi
  sleep 0.25
done

# supabase-js asks for /rest/v1/<table>; a bare PostgREST serves /<table>. The
# tests use the real client, so the prefix is added here rather than special
# cased in every test.
export ELVT_REST_URL="http://127.0.0.1:$PORT"
export ELVT_REST_KIND="postgrest"
export ELVT_REST_PREFIXLESS="1"
export ELVT_REST_DB_URL="$(db_url_for "$DB")"

npx vitest run --config vitest.integration.mts "$@"

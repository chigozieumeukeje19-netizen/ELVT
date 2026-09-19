#!/usr/bin/env bash
# Applies every migration in order to a throwaway database and reports the
# result. Used when the full Supabase stack is not available; `supabase db reset`
# is the real path once Docker can pull the images.
set -euo pipefail

HOST="${PGHOST:-127.0.0.1}"
PORT="${PGPORT:-5433}"
USER="${PGUSER:-postgres}"
DB="${VERIFY_DB:-elvt_verify}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

psql_root() { psql -v ON_ERROR_STOP=1 -h "$HOST" -p "$PORT" -U "$USER" -d postgres "$@"; }
psql_db() { psql -v ON_ERROR_STOP=1 -q -h "$HOST" -p "$PORT" -U "$USER" -d "$DB" "$@"; }

echo "Dropping and recreating $DB"
psql_root -c "drop database if exists $DB with (force);" >/dev/null
psql_root -c "create database $DB;" >/dev/null

echo "Applying Supabase shim"
psql_db -f "$ROOT/tests/sql/supabase_shim.sql" >/dev/null

echo "Checking the shim against the real schema"
psql_db -f "$ROOT/tests/sql/shim_conformance.sql" >/dev/null

for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "Applying $(basename "$f")"
  psql_db -f "$f" >/dev/null
done

echo
echo "Tables created:"
psql_db -t -c "select count(*) from pg_tables where schemaname = 'public';"
echo "Tables with RLS enabled:"
psql_db -t -c "select count(*) from pg_tables where schemaname = 'public' and rowsecurity;"
echo "Policies:"
psql_db -t -c "select count(*) from pg_policies where schemaname = 'public';"
echo "Tables in public WITHOUT RLS (must be empty):"
psql_db -t -c "select coalesce(string_agg(tablename, ', '), 'none') from pg_tables where schemaname = 'public' and not rowsecurity;"

if [ "${WITH_SEED:-1}" = "1" ]; then
  echo
  echo "Applying seed"
  psql_db -f "$ROOT/supabase/seed.sql" >/dev/null
  echo "Clients seeded:"
  psql_db -t -c "select count(*) from public.clients;"
  echo "Profiles by role:"
  psql_db -t -c "select role || ': ' || count(*) from public.profiles group by role order by role;"
fi

echo
echo "Migrations applied cleanly."

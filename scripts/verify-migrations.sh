#!/usr/bin/env bash
# Applies every migration in order to a throwaway database, then the seed, and
# reports the result. `supabase db reset` is the real path; this proves the same
# SQL anywhere a Postgres is reachable.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/db.sh
. "$ROOT/scripts/lib/db.sh"

DB="${VERIFY_DB:-elvt_verify}"

require_db

echo "Server:   $(db_display)"
echo "Dropping and recreating $DB"
psql_db "$(db_default_name)" -c "drop database if exists $DB with (force);" >/dev/null
psql_db "$(db_default_name)" -c "create database $DB;" >/dev/null

# A fresh database on a Supabase server still has no auth schema, because the
# real one lives in Supabase's own database. So the shim is what stands in here
# either way, and scripts/db-conformance.sh is what checks its claims against
# the real schema.
echo "Applying Supabase shim"
psql_db "$DB" -q -f "$ROOT/tests/sql/supabase_shim.sql" >/dev/null

echo "Checking the shim against the real schema"
psql_db "$DB" -q -f "$ROOT/tests/sql/shim_conformance.sql" >/dev/null

for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "Applying $(basename "$f")"
  psql_db "$DB" -q -f "$f" >/dev/null
done

echo
echo "Tables created:"
psql_db "$DB" -t -c "select count(*) from pg_tables where schemaname = 'public';"
echo "Tables with RLS enabled:"
psql_db "$DB" -t -c "select count(*) from pg_tables where schemaname = 'public' and rowsecurity;"
echo "Policies:"
psql_db "$DB" -t -c "select count(*) from pg_policies where schemaname = 'public';"
echo "Tables in public WITHOUT RLS (must be empty):"
psql_db "$DB" -t -c "select coalesce(string_agg(tablename, ', '), 'none') from pg_tables where schemaname = 'public' and not rowsecurity;"

if [ "${WITH_SEED:-1}" = "1" ]; then
  echo
  echo "Applying seed"
  psql_db "$DB" -q -f "$ROOT/supabase/seed.sql" >/dev/null
  # The real seed writes no auth rows; GoTrue does that. The verifier has no
  # GoTrue, so it gets its accounts from a fixture instead.
  echo "Applying verifier accounts"
  psql_db "$DB" -q -f "$ROOT/tests/sql/test_accounts.sql" >/dev/null
  echo "Checking no account would break a GoTrue lookup:"
  psql_db "$DB" -t -c "
    select case when count(*) = 0
                then 'none, every token column holds a string'
                else count(*) || ' USERS WITH A NULL TOKEN COLUMN' end
    from auth.users
    where confirmation_token is null or recovery_token is null
       or email_change_token_new is null or email_change_token_current is null
       or email_change is null;"
  psql_db "$DB" -t -c "
    do \$\$
    begin
      if exists (
        select 1 from auth.users
        where confirmation_token is null or recovery_token is null
           or email_change_token_new is null or email_change_token_current is null
           or email_change is null
      ) then
        raise exception 'An account has a NULL token column. GoTrue scans these into Go strings, so every user lookup would return a 500.';
      end if;
    end
    \$\$;" >/dev/null

  echo "Clients seeded:"
  psql_db "$DB" -t -c "select count(*) from public.clients;"
  echo "Profiles by role:"
  psql_db "$DB" -t -c "select role || ': ' || count(*) from public.profiles group by role order by role;"
fi

echo
echo "Migrations applied cleanly."

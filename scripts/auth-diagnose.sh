#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Pinpoints why GoTrue cannot read its own schema.
#
#   npm run auth:diagnose
#
# "Database error querying schema" and "Database error finding users" both mean
# GoTrue's own database role cannot do something it expects to. This walks every
# table in the auth schema as that role and names the ones that fail, which is
# the answer the error id in the log points at.
# ---------------------------------------------------------------------------
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/env.sh
. "$ROOT/scripts/lib/env.sh"
# shellcheck source=scripts/lib/db.sh
. "$ROOT/scripts/lib/db.sh"

require_env "$ROOT" || exit 1
require_db || exit 1

PSQL=(psql "$ELVT_DB_URL" -X -q)

echo "=============================================================="
echo "1. Roles GoTrue and the Data API depend on"
echo "=============================================================="
"${PSQL[@]}" -c "
  select rolname, rolsuper as superuser, rolbypassrls as bypass_rls, rolcanlogin as can_login
  from pg_roles
  where rolname in ('supabase_auth_admin','authenticator','anon','authenticated',
                    'service_role','supabase_storage_admin','postgres')
  order by rolname;"

echo "=============================================================="
echo "2. Schema level privileges"
echo "=============================================================="
"${PSQL[@]}" -c "
  select nspname as schema,
         coalesce(array_to_string(nspacl, E'\n'), '(default)') as acl
  from pg_namespace where nspname in ('auth','public','extensions') order by nspname;"

echo "=============================================================="
echo "3. Can supabase_auth_admin read each auth table?"
echo "    This is the one that names the broken table."
echo "=============================================================="
"${PSQL[@]}" -t -A -c "
  select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'auth' and c.relkind = 'r' order by 1;" |
while read -r table; do
  [ -z "$table" ] && continue
  if out=$(psql "$ELVT_DB_URL" -X -q -t -A \
      -c "set local role supabase_auth_admin; select count(*) from auth.\"$table\";" 2>&1); then
    printf '  ok      auth.%-28s %s rows\n' "$table" "$out"
  else
    printf '  FAILED  auth.%-28s %s\n' "$table" "$(echo "$out" | head -1)"
  fi
done

echo "=============================================================="
echo "4. Does supabase_auth_admin still hold its grants?"
echo "=============================================================="
"${PSQL[@]}" -c "
  select table_name, string_agg(distinct privilege_type, ', ' order by privilege_type) as privileges
  from information_schema.table_privileges
  where table_schema = 'auth' and grantee = 'supabase_auth_admin'
  group by table_name order by table_name;"

echo "=============================================================="
echo "5. Public tables where anon was revoked (our only privilege change)"
echo "=============================================================="
"${PSQL[@]}" -t -A -c "
  select count(*) || ' public tables, ' ||
         count(*) filter (
           where has_table_privilege('anon', (quote_ident(schemaname)||'.'||quote_ident(tablename))::regclass, 'SELECT')
         ) || ' where anon can still select'
  from pg_tables where schemaname = 'public';"

echo "=============================================================="
echo "6. What GoTrue says right now"
echo "=============================================================="
URL="${NEXT_PUBLIC_SUPABASE_URL%/}"
curl -s -X POST "$URL/auth/v1/token?grant_type=password" \
  -H "apikey: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${SEED_COACH_EMAIL:-coach@elvt.test}\",\"password\":\"${SEED_COACH_PASSWORD:-ElvtCoach2026}\"}"
echo
echo
echo "If section 3 shows a FAILED line, that table is the answer."
echo "If section 3 is all ok and section 6 still fails, the problem is not"
echo "database privileges and the GoTrue container log will name it."

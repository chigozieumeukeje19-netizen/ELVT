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
echo "3. Does supabase_auth_admin hold SELECT on each auth table?"
echo "    Checked by asking the catalog, not by switching role: the"
echo "    connecting user is usually not a member of that role, and a"
echo "    failed SET ROLE looks exactly like a broken grant."
echo "=============================================================="
"${PSQL[@]}" -t -A -c "
  select case when has_table_privilege('supabase_auth_admin', c.oid, 'SELECT')
              then '  ok      auth.' || c.relname
              else '  MISSING auth.' || c.relname || '  (no SELECT for supabase_auth_admin)'
         end
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'auth' and c.relkind = 'r'
  order by c.relname;" 2>&1

echo "=============================================================="
echo "3b. Columns GoTrue reads as strings that are NULL"
echo "     A NULL here makes every user lookup fail with a 500,"
echo "     because Go cannot scan NULL into a string."
echo "=============================================================="
"${PSQL[@]}" -t -A -c "
  select '  ' || email || ' :: ' ||
         concat_ws(', ',
           case when confirmation_token is null then 'confirmation_token' end,
           case when recovery_token is null then 'recovery_token' end,
           case when email_change_token_new is null then 'email_change_token_new' end,
           case when email_change_token_current is null then 'email_change_token_current' end,
           case when email_change is null then 'email_change' end
         ) || ' IS NULL'
  from auth.users
  where confirmation_token is null or recovery_token is null
     or email_change_token_new is null or email_change_token_current is null
     or email_change is null
  order by email;" 2>&1
"${PSQL[@]}" -t -A -c "
  select case when count(*) = 0 then '  none. Every token column holds a string.'
              else '  ' || count(*) || ' users above will 500 on any lookup.' end
  from auth.users
  where confirmation_token is null or recovery_token is null
     or email_change_token_new is null or email_change_token_current is null
     or email_change is null;" 2>&1

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
echo "Section 3 names a missing grant. Section 3b names a NULL column, which"
echo "is the more common cause and produces the same 500. If both are clean"
echo "and section 6 still fails, the GoTrue container log has the reason:"
echo "  docker logs \$(docker ps --format '{{.Names}}' | grep -i auth) --tail 50"

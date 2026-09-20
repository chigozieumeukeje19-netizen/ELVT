#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# The two findings Supabase's cloud linter caught that the local stack could
# not, as a check that runs anywhere a Postgres is reachable.
#
# This is the third time production has shown something local could not: the
# generated column, the null token column, and now the API-exposed function
# grants. The pattern is that the local stack is permissive where the cloud is
# not, and each gap stayed invisible until something real was pointed at it. So
# rather than adding a third one-off assertion, these two run the linter's
# questions against whatever database they are given.
#
#   A. A SECURITY DEFINER function in an exposed schema that `anon` or
#      `authenticated` may execute. That is a callable /rest/v1/rpc/<name>.
#   B. A function with a role-mutable search_path, which is the escalation
#      route that makes A worth caring about.
#
# Reads ELVT_DB_URL like everything else here. Pass a URL to check another
# database: bash scripts/db-security-check.sh "$PROD_DB_URL"
# ---------------------------------------------------------------------------
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/db.sh
. "$ROOT/scripts/lib/db.sh"

TARGET="${1:-$ELVT_DB_URL}"

# Schemas PostgREST serves. A function outside these is not reachable over
# HTTP however it is granted, which is the whole reason `private` exists.
EXPOSED="${EXPOSED_SCHEMAS:-public,graphql_public}"

# Schemas whose functions must pin a search_path. The exposed ones, plus our
# own internals, because that is where the SECURITY DEFINER functions moved to.
PINNED="${PINNED_SCHEMAS:-public,graphql_public,private}"

if ! psql "$TARGET" -tAc "select 1" >/dev/null 2>&1; then
  cat >&2 <<MSG

Cannot reach a database, so nothing about it was checked.

This is a failure rather than a skip: a deploy that has not looked at the
database it is deploying against has not been checked. Point it at one:

  ELVT_DB_URL=postgresql://... bash scripts/db-security-check.sh

MSG
  exit 1
fi

failed=0

echo "Database: $TARGET"
echo

# --- A ---------------------------------------------------------------------
definers="$(psql "$TARGET" -tA <<SQL
select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
  || ' executable by '
  || case
       when has_function_privilege('anon', p.oid, 'execute')
        and has_function_privilege('authenticated', p.oid, 'execute') then 'anon and authenticated'
       when has_function_privilege('anon', p.oid, 'execute') then 'anon'
       else 'authenticated'
     end
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = any (string_to_array('$EXPOSED', ','))
  and p.prosecdef
  and (has_function_privilege('anon', p.oid, 'execute')
       or has_function_privilege('authenticated', p.oid, 'execute'))
order by 1;
SQL
)"

if [ -z "$definers" ]; then
  echo "  ok    No SECURITY DEFINER function in ($EXPOSED) is callable by anon or authenticated"
else
  echo "  FAIL  A SECURITY DEFINER function is callable over the Data API:"
  while IFS= read -r line; do echo "          $line"; done <<< "$definers"
  echo "        Each of these is a live /rest/v1/rpc/<name>. Revoke execute from"
  echo "        PUBLIC, not just from anon and authenticated: the default grant is"
  echo "        to PUBLIC and revoking from the roles alone changes nothing."
  failed=$((failed + 1))
fi

# --- B ---------------------------------------------------------------------
mutable="$(psql "$TARGET" -tA <<SQL
select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = any (string_to_array('$PINNED', ','))
  and p.prokind = 'f'
  and not exists (
    select 1 from unnest(coalesce(p.proconfig, '{}')) as cfg
     where cfg like 'search\_path=%'
  )
order by 1;
SQL
)"

if [ -z "$mutable" ]; then
  echo "  ok    Every function in ($PINNED) pins its search_path"
else
  echo "  FAIL  A function has a role-mutable search_path:"
  while IFS= read -r line; do echo "          $line"; done <<< "$mutable"
  echo "        Add 'set search_path = ''' and qualify every reference inside it."
  failed=$((failed + 1))
fi

echo
if [ "$failed" -gt 0 ]; then
  echo "$failed database security check(s) failed."
  exit 1
fi
echo "Database security checks passed."

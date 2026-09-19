# ---------------------------------------------------------------------------
# One connection setting for everything that talks to Postgres.
#
# ELVT_DB_URL points at the server. It defaults to the local Supabase stack,
# because that is what every machine running this project has. A container with
# no Supabase overrides it; nothing else should need to.
#
# Sourced by the verification scripts. Not executable on its own.
# ---------------------------------------------------------------------------

# Read from .env.local when the shell has not already exported it, the same
# way the Next server, the Playwright config and the Vitest config read it.
# Without this the setting was real for whichever shell had run `export` and
# invisible to every other one, so `npm run db:verify` reported that Postgres
# was unreachable on a machine where it was running and configured.
if [ -z "${ELVT_DB_URL:-}" ]; then
  _db_env_file="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/${ENV_FILE:-.env.local}"
  if [ -f "$_db_env_file" ]; then
    _db_from_file="$(sed -n 's/^[[:space:]]*ELVT_DB_URL[[:space:]]*=[[:space:]]*//p' "$_db_env_file" | tail -1)"
    # Strip one layer of surrounding quotes, which dotenv files often carry.
    _db_from_file="${_db_from_file%\"}"; _db_from_file="${_db_from_file#\"}"
    _db_from_file="${_db_from_file%\'}"; _db_from_file="${_db_from_file#\'}"
    [ -n "$_db_from_file" ] && ELVT_DB_URL="$_db_from_file"
  fi
  unset _db_env_file _db_from_file
fi

ELVT_DB_URL="${ELVT_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

# Swaps the database name on the connection URL, keeping host, credentials and
# any query string. Used to reach a throwaway verification database on the same
# server as the real one.
db_url_for() {
  local dbname="$1"
  local without_query="${ELVT_DB_URL%%\?*}"
  local query=""
  if [ "$without_query" != "$ELVT_DB_URL" ]; then
    query="?${ELVT_DB_URL#*\?}"
  fi
  printf '%s/%s%s' "${without_query%/*}" "$dbname" "$query"
}

# The database the connection setting itself names.
db_default_name() {
  local without_query="${ELVT_DB_URL%%\?*}"
  printf '%s' "${without_query##*/}"
}

# A readable version with the password removed, for error messages.
db_display() {
  printf '%s' "$ELVT_DB_URL" | sed -E 's#://([^:/@]+):[^@]*@#://\1:****@#'
}

# Fails with something a person can act on rather than a bare psql error.
require_db() {
  if psql "$ELVT_DB_URL" -Atc 'select 1' >/dev/null 2>&1; then
    return 0
  fi

  cat >&2 <<MSG

Cannot reach Postgres.

  Tried:    $(db_display)
  Setting:  ELVT_DB_URL

This defaults to the local Supabase stack. If it is not running:

  supabase start

If Supabase is running on a different port, check it with:

  supabase status

and export the connection string it prints, for example:

  export ELVT_DB_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres'

If you are on a machine with no Supabase and only a plain Postgres, point
ELVT_DB_URL at that server instead. See docs/LOCAL_VS_PRODUCTION.md.

MSG
  return 1
}

# psql against a named database on the same server.
psql_db() {
  local dbname="$1"
  shift
  psql -v ON_ERROR_STOP=1 "$(db_url_for "$dbname")" "$@"
}

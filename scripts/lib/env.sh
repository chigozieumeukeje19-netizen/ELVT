# ---------------------------------------------------------------------------
# The environment the end to end run needs, checked before anything starts.
#
# Missing keys used to surface as a 500 from inside a route handler, which
# turned an expected 401 into a server error and every redirect assertion into
# an error page. A crash inside a request is not a configuration check.
# ---------------------------------------------------------------------------

ENV_FILE="${ENV_FILE:-.env.local}"

# Every variable the server or the tests read. The first two are what the app
# needs to serve a page at all.
REQUIRED_ENV=(
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  SUPABASE_JWT_SECRET
  PORTAL_API_KEY
)

load_env_file() {
  local root="$1"
  if [ ! -f "$root/$ENV_FILE" ]; then
    return 1
  fi
  set -a
  # shellcheck disable=SC1090
  . "$root/$ENV_FILE"
  set +a
  return 0
}

require_env() {
  local root="$1"

  if ! load_env_file "$root"; then
    cat >&2 <<MSG

$ENV_FILE does not exist.

The end to end tests run a real server against a real Supabase, so they need
the project keys. Create it from the example, which lists every variable and
says where each value comes from:

  cp .env.example .env.local

Then fill in the values printed by:

  supabase status

MSG
    return 1
  fi

  local missing=()
  local name
  for name in "${REQUIRED_ENV[@]}"; do
    if [ -z "${!name:-}" ]; then
      missing+=("$name")
    fi
  done

  if [ ${#missing[@]} -gt 0 ]; then
    {
      echo
      echo "$ENV_FILE is missing values for:"
      echo
      for name in "${missing[@]}"; do
        echo "  $name"
      done
      cat <<'MSG'

Print them with:

  supabase status

The anon and service role lines may be named "Publishable key" and
"Secret key" on a newer CLI. Either format works. See .env.example for the
mapping, and for how to generate the two secrets that are yours to invent.

MSG
    } >&2
    return 1
  fi

  return 0
}


# One host everywhere. Needs nothing running, so it is checked on every run
# rather than only when the stack happens to be up.
check_single_host() {
  local root="$1"
  # One host everywhere. A browser treats localhost and 127.0.0.1 as different
  # origins, so a session cookie set on one is never sent to the other. If
  # site_url disagrees with the host the tests use, magic links land on the
  # origin the session is not on and the client is bounced to the login page.
  local host="${E2E_HOST:-127.0.0.1}"
  local site_url
  site_url="$(grep -E '^site_url' "$root/supabase/config.toml" | head -1 | cut -d'"' -f2)"

  if [ -n "$site_url" ] && [[ "$site_url" != *"$host"* ]]; then
    cat >&2 <<MSG

Host mismatch.

  supabase/config.toml site_url : $site_url
  tests and E2E_HOST            : $host

These must be the same host. A browser treats localhost and 127.0.0.1 as
different origins, so a session set on one is invisible to the other and a
magic link will land the client back on the login page.

Change site_url in supabase/config.toml, then restart:

  supabase stop && supabase start

MSG
    return 1
  fi

  if grep -q "localhost" <<<"$(grep -E '^site_url|^additional_redirect_urls' -A3 "$root/supabase/config.toml")"; then
    cat >&2 <<MSG

supabase/config.toml still allows a localhost redirect alongside 127.0.0.1.

Two allowed origins is the bug, not the safety net: a magic link can land on
whichever one GoTrue picks, and only one of them has the session.

MSG
    return 1
  fi

  echo "One host everywhere: ${E2E_HOST:-127.0.0.1}."
  return 0
}

# Proves the keys are accepted rather than merely present. A pasted key from
# the wrong project is non blank and still wrong, and this is the cheapest
# place to find that out.
verify_supabase_keys() {
  local url="${NEXT_PUBLIC_SUPABASE_URL%/}"

  if ! curl -fsS --max-time 3 "$url/auth/v1/health" >/dev/null 2>&1; then
    cat >&2 <<MSG

Supabase is not reachable at $url.

The eight auth tests are the only ones that sign anyone in. Without the stack
they FAIL rather than skip, because a skip there reads like a pass. Start it:

  supabase start
  supabase db reset

They skip only in CI, which has no stack.

MSG
    return 0
  fi

  local anon_status
  anon_status="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 \
    "$url/rest/v1/" -H "apikey: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}")"

  if [ "$anon_status" = "401" ] || [ "$anon_status" = "403" ]; then
    cat >&2 <<MSG

NEXT_PUBLIC_SUPABASE_ANON_KEY is set but Supabase rejected it (HTTP $anon_status).

It is probably from a different project, or truncated. Copy it again from:

  supabase status

Both the legacy JWT anon key and a newer sb_publishable_ key are accepted.

MSG
    return 1
  fi

  local service_status
  service_status="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 \
    "$url/rest/v1/clients?select=id&limit=1" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}")"

  if [ "$service_status" != "200" ]; then
    cat >&2 <<MSG

SUPABASE_SERVICE_ROLE_KEY did not work (HTTP $service_status).

The auth tests use it to generate magic links, so they cannot run without it.
Copy it again from:

  supabase status

Both the legacy JWT service_role key and a newer sb_secret_ key are accepted.
A 404 here means the schema is not applied: run `supabase db reset` first.

MSG
    return 1
  fi

  local mailbox="${MAILBOX_URL:-http://127.0.0.1:54324}"
  if ! curl -fsS --max-time 3 "$mailbox/api/v1/messages?limit=1" >/dev/null 2>&1; then
    cat >&2 <<MSG

Mailpit is not answering at $mailbox.

The client magic link test reads the link from there, because there is no SMTP
configured locally. Check the inbucket port with `supabase status`, or set
MAILBOX_URL.

MSG
    return 1
  fi

  echo "Supabase reachable, both keys accepted, Mailpit answering."
  return 0
}

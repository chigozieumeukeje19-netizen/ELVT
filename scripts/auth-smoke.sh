#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Answers, from the command line, whether the seeded accounts can actually
# sign in. No browser, no Playwright, no app code in the way.
#
#   npm run auth:smoke
#
# Prints what is in auth.users, what identities exist, and what GoTrue says to
# a real password grant for the coach.
# ---------------------------------------------------------------------------
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/env.sh
. "$ROOT/scripts/lib/env.sh"
# shellcheck source=scripts/lib/db.sh
. "$ROOT/scripts/lib/db.sh"

require_env "$ROOT" || exit 1

URL="${NEXT_PUBLIC_SUPABASE_URL%/}"
COACH="${SEED_COACH_EMAIL:-coach@elvt.test}"
PASSWORD="${SEED_COACH_PASSWORD:-ElvtCoach2026}"

echo "=============================================================="
echo "1. Accounts in auth.users"
echo "=============================================================="
psql "$ELVT_DB_URL" -t -A -F '  ' -c "
  select email,
         case when encrypted_password is null then 'NO PASSWORD'
              else 'password set, cost ' || split_part(encrypted_password, '\$', 3) end,
         case when email_confirmed_at is null then 'NOT CONFIRMED' else 'confirmed' end
  from auth.users order by email;" 2>&1

echo
echo "=============================================================="
echo "2. Identities, which GoTrue needs to resolve an email sign in"
echo "=============================================================="
psql "$ELVT_DB_URL" -t -A -F '  ' -c "
  select u.email, i.provider, coalesce(i.email, 'NO GENERATED EMAIL')
  from auth.users u
  left join auth.identities i on i.user_id = u.id
  order by u.email;" 2>&1

echo
echo "=============================================================="
echo "3. Clients linked to a profile"
echo "=============================================================="
psql "$ELVT_DB_URL" -t -A -F '  ' -c "
  select c.slug,
         case when c.profile_id is null then 'NOT LINKED' else 'linked' end
  from public.clients c order by c.slug;" 2>&1

echo
echo "=============================================================="
echo "4. A real password grant against GoTrue for $COACH"
echo "=============================================================="
RESPONSE="$(curl -s -X POST "$URL/auth/v1/token?grant_type=password" \
  -H "apikey: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$COACH\",\"password\":\"$PASSWORD\"}")"

if echo "$RESPONSE" | grep -q '"access_token"'; then
  echo "PASS. GoTrue issued a token."
  echo "$RESPONSE" | head -c 200
  echo "..."
  echo
  echo "Sign in works. If the browser still fails, the problem is the app,"
  echo "not the seed."
  exit 0
fi

echo "FAIL. GoTrue refused the credentials. It said:"
echo
echo "$RESPONSE"
echo
echo "Run 'npm run db:reset', which now recreates these accounts through"
echo "GoTrue's own admin API rather than by hand written SQL."
exit 1

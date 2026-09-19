#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# The deploy dry run.
#
# Everything a deploy would do, short of spending credits: build the way the
# host builds, serve what comes out with a deployed environment rather than a
# local one, and ask the running server the questions a first visitor asks.
#
# Two sections, and they mean different things.
#
#   REPO CHECKS are facts about this repository. A failure here is a bug and
#   the fix is a commit.
#
#   DEPLOY BLOCKERS are things a human has to supply or decide. A failure here
#   is not a bug, and it still means the answer to "can this be deployed" is
#   no. They are listed in docs/DEPLOY.md with what each one needs.
#
# The script exits non-zero if either section has a failure, because a dry run
# that says ready while the nightly job has no scheduler is worse than no dry
# run at all.
# ---------------------------------------------------------------------------
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/lib/env.sh
. "$ROOT/scripts/lib/env.sh"

FAILED=0
BLOCKED=0

pass()  { printf '  ok    %s\n' "$1"; }
fail()  { printf '  FAIL  %s\n' "$1"; FAILED=$((FAILED + 1)); }
block() { printf '  TODO  %s\n' "$1"; BLOCKED=$((BLOCKED + 1)); }

echo
echo "DEPLOY DRY RUN"
echo "=============="
echo
echo "REPO CHECKS"
echo

# --- Node ------------------------------------------------------------------
# The host builds on whatever NODE_VERSION says. A repo that is tested on one
# major and built on another is one deploy away from finding out why.
netlify_node="$(grep -oE 'NODE_VERSION = "[0-9]+"' netlify.toml | grep -oE '[0-9]+' || true)"
ci_node="$(grep -oE 'node-version: "[0-9]+"' .github/workflows/ci.yml | grep -oE '[0-9]+' || true)"
if [ -n "$netlify_node" ] && [ "$netlify_node" = "$ci_node" ]; then
  pass "Node $netlify_node on the host and in CI"
else
  fail "Node major differs: netlify.toml says '${netlify_node:-unset}', CI says '${ci_node:-unset}'"
fi

# --- Secrets ---------------------------------------------------------------
if git ls-files --error-unmatch .env.local >/dev/null 2>&1; then
  fail ".env.local is committed. It holds keys."
else
  pass ".env.local is not committed"
fi

# --- Every variable the app needs is documented ----------------------------
# A deploy is configured from .env.example by a person reading it. A variable
# the code requires and the example does not mention is a 500 on the first
# request that touches it.
missing_docs=()
for name in "${REQUIRED_ENV[@]}"; do
  grep -qE "^#? ?${name}=" .env.example || missing_docs+=("$name")
done
if [ ${#missing_docs[@]} -eq 0 ]; then
  pass "Every required variable is in .env.example"
else
  fail "Not in .env.example: ${missing_docs[*]}"
fi

# --- The preview flag is nowhere near a deploy -----------------------------
# CI checks netlify.toml and .env.example. This also checks the workflows,
# because a scheduled job that sets it is a live site serving the routes.
# An assignment, not a mention. CI's own guard greps for the name, and a
# check that cannot tell the guard from the thing it guards against is noise.
if grep -rnE "ENABLE_DESIGN_PREVIEW[[:space:]]*[:=]" \
     netlify.toml .env.example .github/workflows >/dev/null 2>&1; then
  fail "ENABLE_DESIGN_PREVIEW appears on a deploy surface"
else
  pass "The preview flag is absent from every deploy surface"
fi

# --- Build the way the host builds -----------------------------------------
echo
echo "  building, the way netlify.toml says to..."
build_env_url="${NEXT_PUBLIC_SUPABASE_URL:-http://127.0.0.1:54321}"
build_env_anon="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-dry-run-placeholder}"
if NEXT_PUBLIC_SUPABASE_URL="$build_env_url" \
   NEXT_PUBLIC_SUPABASE_ANON_KEY="$build_env_anon" \
   npm run build > /tmp/elvt-dry-run-build.log 2>&1; then
  pass "npm run build"
else
  fail "npm run build (see /tmp/elvt-dry-run-build.log)"
  tail -20 /tmp/elvt-dry-run-build.log
fi

# --- Serve it the way a deploy serves it -----------------------------------
# Playwright starts and stops that server. Doing it from here leaked a
# next-server on every run, and the run after that was answered by the stale
# one rather than by the build it had just made: a removed preview gate still
# reported 404 that way.
echo
echo "  serving the build, without the preview flag..."
if npx playwright test -c playwright.deploy.config.ts > /tmp/elvt-dry-run-served.log 2>&1; then
  # Each question the spec asks, named, so this reads as checks rather than as
  # one opaque green line.
  grep -oE "› [^›]+ \\([0-9]+ms\\)$" /tmp/elvt-dry-run-served.log \
    | sed -E 's/^› //; s/ \([0-9]+ms\)$//' \
    | while IFS= read -r line; do printf '  ok    %s\n' "$line"; done
else
  fail "The served build answered something wrong"
  grep -E "✘|Error:|Expected|Received" /tmp/elvt-dry-run-served.log | head -12
  echo "        full output: /tmp/elvt-dry-run-served.log"
fi

# --- What a human still has to supply --------------------------------------
echo
echo "DEPLOY BLOCKERS"
echo

# The four jobs tick every few minutes and nothing runs them. Every automatic
# thing this product does -- the week roll, the nightly triggers, reminders,
# scheduled messages -- is on the other side of this.
if grep -rlE "npm run (nightly|week:roll|reminders:dispatch|messages:dispatch)" \
     .github/workflows netlify.toml 2>/dev/null | grep -qv ci.yml; then
  pass "The four scheduled jobs have a scheduler"
else
  block "Nothing runs the four scheduled jobs. See docs/DEPLOY.md."
fi

# Production values. The dry run cannot know them and will not pretend to.
block "Production Supabase values are set on the host. See docs/DEPLOY.md."

echo
echo "-------------------------------------------------------------"
if [ "$FAILED" -gt 0 ]; then
  echo "$FAILED repo check(s) failed. That is a bug; fix it in a commit."
fi
if [ "$BLOCKED" -gt 0 ]; then
  echo "$BLOCKED blocker(s) need a human. That is a decision, not a bug."
fi
if [ "$FAILED" -eq 0 ] && [ "$BLOCKED" -eq 0 ]; then
  echo "Ready to deploy."
  exit 0
fi
echo "NOT ready to deploy."
exit 1

#!/usr/bin/env bash
# Starts the production server for a Playwright run, after checking there is
# something to serve. Without this, a missing build surfaces as a raw Next
# error inside a webServer timeout, which says nothing about what to do.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${1:-3000}"

if [ ! -f "$ROOT/.next/BUILD_ID" ]; then
  cat >&2 <<'MSG'

No production build to serve.

The end to end tests run against a production build, and there is none in
.next. Build it first:

  npm run build

Or run the whole thing, which builds and then tests:

  npm run test:e2e

MSG
  exit 1
fi

exec npx next start -p "$PORT"

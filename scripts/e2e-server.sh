#!/usr/bin/env bash
# Starts the production server for a Playwright run, after checking there is
# something to serve. Without this, a missing build surfaces as a raw Next
# error inside a webServer timeout, which says nothing about what to do.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${1:-3000}"

# shellcheck source=scripts/lib/env.sh
. "$ROOT/scripts/lib/env.sh"

# The server reads these at request time and throws without them, which turns
# every assertion in the suite into an error page. Refuse to start instead.
require_env "$ROOT"

# Checked here as well as in the preflight, because this is the process that
# actually binds and something can take the port in between.
require_free_ports "$PORT"

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

# next's own binary, not npx. npx forks a child and Playwright signals the
# parent, so an npx layer here leaves a next-server holding the port after the
# run ends. The next run then either fails to bind or, worse, is answered by
# the stale server and reports on a build nobody made.
exec "$ROOT/node_modules/.bin/next" start -p "$PORT"

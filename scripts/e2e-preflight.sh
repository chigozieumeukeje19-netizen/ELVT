#!/usr/bin/env bash
# Refuses to start the end to end run when the environment cannot support it,
# naming exactly what is wrong. Runs before the build, so a misconfigured run
# costs seconds rather than a build plus a suite of confusing failures.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/env.sh
. "$ROOT/scripts/lib/env.sh"

require_env "$ROOT"
check_single_host "$ROOT"

# Before the build, because a taken port costs the whole run and finding out
# after a two minute build is the expensive way to learn it.
require_free_ports "${PORT:-3000}" "${UNFLAGGED_PORT:-3101}"

verify_supabase_keys
echo "Environment looks right."

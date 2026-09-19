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
verify_supabase_keys
echo "Environment looks right."

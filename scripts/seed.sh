#!/usr/bin/env bash
# Applies the seed to the database ELVT_DB_URL names.
#
# `supabase db reset` already runs this file as part of a reset. This is for
# reseeding without rebuilding the schema.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/db.sh
. "$ROOT/scripts/lib/db.sh"

require_db

echo "Seeding $(db_display)"
psql -v ON_ERROR_STOP=1 "$ELVT_DB_URL" -q -f "$ROOT/supabase/seed.sql"
echo "Seeded."

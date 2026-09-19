/**
 * The nightly trigger and retention job.
 *
 * Ticks every few minutes and evaluates whichever clients have just reached
 * 21:00 in their own evening. Idempotent, so an extra tick costs nothing.
 */

import { createClient } from "@supabase/supabase-js";
import { runNightly } from "../src/lib/engine/run-triggers";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`\n${name} is not set, so the nightly job cannot run.\n`);
    process.exit(1);
  }
  return value;
}

async function main() {
  const supabase = createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  const at = process.env.NIGHTLY_AT ? new Date(process.env.NIGHTLY_AT) : new Date();
  if (Number.isNaN(at.getTime())) {
    console.error(`\nNIGHTLY_AT is not a date: ${process.env.NIGHTLY_AT}\n`);
    process.exit(1);
  }

  const results = await runNightly(supabase, at);
  const fired = results.reduce((total, result) => total + result.fired, 0);

  console.log(`Nightly at ${at.toISOString()}`);
  console.log(`  ${results.length} active clients, ${fired} items raised`);

  for (const result of results) {
    console.log(
      `  ${result.slug.padEnd(20)} ${
        result.fired > 0 ? `${result.fired} raised` : (result.skipped ?? "nothing to raise")
      }`,
    );
  }
}

main().catch((error) => {
  console.error(`\nThe nightly job failed: ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});

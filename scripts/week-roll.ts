/**
 * The week roll, run from a scheduler.
 *
 * Ticks every few minutes and rolls whichever clients have just reached 23:59
 * on their own Sunday. Running it more often than that costs nothing: the job
 * is idempotent, so an extra tick produces an empty plan.
 *
 * Takes the service role key, because it writes for clients who are asleep.
 * That is also why it is a script and not a route handler.
 */

import { createClient } from "@supabase/supabase-js";
import { runWeekRoll } from "../src/lib/engine/run-week-roll";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`\n${name} is not set, so the week roll cannot run.\n`);
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

  // An explicit instant makes the job replayable, which is how a missed Sunday
  // is caught up without waiting a week for the next one.
  const at = process.env.WEEK_ROLL_AT ? new Date(process.env.WEEK_ROLL_AT) : new Date();
  if (Number.isNaN(at.getTime())) {
    console.error(`\nWEEK_ROLL_AT is not a date: ${process.env.WEEK_ROLL_AT}\n`);
    process.exit(1);
  }

  const results = await runWeekRoll(supabase, at);

  const rolled = results.filter((result) => result.applied > 0);
  console.log(`Week roll at ${at.toISOString()}`);
  console.log(`  ${results.length} active clients, ${rolled.length} rolled`);

  for (const result of results) {
    console.log(
      `  ${result.slug.padEnd(20)} ${
        result.applied > 0 ? `${result.applied} writes` : (result.skipped ?? "nothing to do")
      }`,
    );
  }
}

main().catch((error) => {
  console.error(`\nThe week roll failed: ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});

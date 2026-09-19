/**
 * The reminder dispatcher.
 *
 * Ticks every few minutes, works out what is due for each client on their own
 * clock, and sends it. Anything inside an hour goes as one digest, so a tick
 * that has been down all morning catches up without five separate pings.
 *
 * The work is in src/lib/reminders/dispatch.ts so there is something a test can
 * point at. This is the process around it.
 */

import { createClient } from "@supabase/supabase-js";
import { dispatchReminders } from "../src/lib/reminders/dispatch";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`\n${name} is not set, so the dispatcher cannot run.\n`);
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

  const at = process.env.REMINDERS_AT ? new Date(process.env.REMINDERS_AT) : new Date();
  const result = await dispatchReminders(supabase, at);

  console.log(`Reminders at ${result.at}`);

  for (const line of result.lines) {
    console.log(
      `  ${line.slug.padEnd(20)} ${
        line.skipped ?? `${line.dispatches} sent covering ${line.kinds.length} reminders`
      }`,
    );
  }

  console.log(`  ${result.sent} dispatches in total`);
}

main().catch((error) => {
  console.error(`\nThe dispatcher failed: ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});

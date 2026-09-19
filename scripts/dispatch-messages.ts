/**
 * The scheduled message dispatcher.
 *
 * Ticks every few minutes and sends whatever has come due. A message more than
 * a few hours late is left unsent rather than waking a client in the middle of
 * their night with yesterday's nudge.
 *
 * The work is in src/lib/messages/dispatch.ts so there is something a test can
 * point at. This is the process around it: environment, clock, output, exit
 * code.
 */

import { createClient } from "@supabase/supabase-js";
import { dispatchMessages } from "../src/lib/messages/dispatch";

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

  const at = process.env.DISPATCH_AT ? new Date(process.env.DISPATCH_AT) : new Date();
  const result = await dispatchMessages(supabase, at);

  console.log(`Dispatch at ${result.at}`);
  console.log(`  ${result.pending} scheduled, ${result.sent} sent`);

  for (const line of result.lines.filter((candidate) => !candidate.sent)) {
    console.log(`  ${line.id} held: ${line.reason}`);
  }
}

main().catch((error) => {
  console.error(`\nThe dispatcher failed: ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});

import { NextResponse } from "next/server";
import { z } from "zod";
import { handler, jsonBody, writeFailure } from "@/lib/api/context";

export const dynamic = "force-dynamic";

const schema = z.object({
  token: z.string().min(10).max(500),
  platform: z.enum(["ios", "android", "web"]),
});

/** At most this many devices per client. The sixth push retires the oldest. */
const KEEP = 5;

/**
 * POST /api/v1/device
 *
 * Registration writes to the `devices` table, which exists for exactly this
 * and which the client may write to. It used to write the token into
 * `clients.communication_prefs` instead, and `clients` carries one client
 * policy and it is SELECT, so registration has been refused by RLS the whole
 * time. The route reported "That could not be saved", which was true and
 * useless.
 *
 * Nothing sends to these yet. Push needs a paid service and standing rule 12
 * says no paid APIs, so the reminder dispatcher records what it would have
 * sent and stops. A registered device does not mean a phone will buzz.
 */
export const POST = handler(async ({ clientId, db }, request) => {
  const body = await jsonBody(request, schema);

  const { data, error } = await db
    .from("devices")
    .upsert(
      { client_id: clientId, push_token: body.token, platform: body.platform },
      { onConflict: "client_id,push_token" },
    )
    .select("id");

  const failure = writeFailure(error, data, "the device");
  if (failure) return failure;

  // Oldest first, keep the newest few. A client who reinstalls repeatedly
  // should not accumulate dead tokens forever.
  const { data: all } = await db
    .from("devices")
    .select("id")
    .eq("client_id", clientId)
    .order("updated_at", { ascending: false });

  const stale = (all ?? []).slice(KEEP).map((device) => device.id);
  if (stale.length > 0) {
    await db.from("devices").delete().in("id", stale);
  }

  return NextResponse.json({ registered: true, devices: Math.min((all ?? []).length, KEEP) });
});

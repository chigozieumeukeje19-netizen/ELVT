import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, handler, jsonBody } from "@/lib/api/context";

export const dynamic = "force-dynamic";

const schema = z.object({
  token: z.string().min(10).max(500),
  platform: z.enum(["ios", "android", "web"]),
});

/**
 * POST /api/v1/device
 *
 * Stored on the client's own row, under the client id from the token. Nothing
 * sends to these yet: push needs a paid service and standing rule 12 says no
 * paid APIs, so the reminder dispatcher records what it would have sent and
 * stops there.
 */
export const POST = handler(async ({ clientId, db }, request) => {
  const body = await jsonBody(request, schema);

  const { data: client } = await db
    .from("clients")
    .select("communication_prefs")
    .eq("id", clientId)
    .maybeSingle();

  const prefs = (client?.communication_prefs ?? {}) as {
    devices?: { token: string; platform: string }[];
  };

  const devices = [
    ...(prefs.devices ?? []).filter((device) => device.token !== body.token),
    { token: body.token, platform: body.platform },
  ].slice(-5);

  const { data, error } = await db
    .from("clients")
    .update({ communication_prefs: { ...prefs, devices } })
    .eq("id", clientId)
    .select("id");

  if (error || !data || data.length === 0) return apiError(400, "That could not be saved.");
  return NextResponse.json({ registered: true, devices: devices.length });
});

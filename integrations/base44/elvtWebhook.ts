/**
 * elvtWebhook
 *
 * Paste this into a Base44 backend function and give the portal its endpoint
 * URL. It runs on Deno.
 *
 * The portal calls this when something changes that the app is showing:
 * week_published, message_sent, plan_changed. The app refetches rather than
 * being handed the new data, because the portal is the truth and a payload that
 * carries state is a payload that can arrive out of order.
 *
 * Verified with a shared secret and a constant time compare, so the endpoint
 * cannot be probed a character at a time, and a request without it is refused
 * before anything is read.
 *
 * Secrets: ELVT_WEBHOOK_SECRET.
 */

const KNOWN = ["week_published", "message_sent", "plan_changed", "week_rolled"];

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method !== "POST") return json({ error: "POST only." }, 405);

  const secret = Deno.env.get("ELVT_WEBHOOK_SECRET");
  if (!secret) return json({ error: "ELVT_WEBHOOK_SECRET is not set." }, 500);

  const presented = request.headers.get("x-elvt-signature") ?? "";
  if (!matches(presented, secret)) {
    return json({ error: "Unauthorized." }, 401);
  }

  let event: { type?: string; client_id?: string; payload?: unknown };
  try {
    event = await request.json();
  } catch {
    return json({ error: "Body must be JSON." }, 400);
  }

  if (!event.type || !KNOWN.includes(event.type)) {
    // Acknowledged rather than refused. An unknown event is a portal that has
    // moved on, and answering with an error would make it retry forever.
    return json({ received: true, acted: false });
  }

  // Where the Base44 app is told to refetch. What that looks like depends on
  // the app, so it is left as one call rather than guessed at here.
  //
  //   await base44.realtime.publish(`client:${event.client_id}`, { type: event.type });

  return json({ received: true, acted: true, type: event.type });
});

/** Constant time, so the secret cannot be probed a character at a time. */
function matches(presented: string, expected: string): boolean {
  if (presented.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < presented.length; i += 1) {
    diff |= presented.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

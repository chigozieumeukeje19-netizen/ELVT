/**
 * elvtPost
 *
 * Paste this into a Base44 backend function. It runs on Deno.
 *
 * Forwards a write to the portal with the client's token. The portal validates
 * every write against the token's client_id at its row level security layer, so
 * this function does not need to check anything about who owns what, and
 * deliberately does not try: a check here would be a second implementation of a
 * rule that already holds, and the two would drift.
 *
 * Secrets: ELVT_PORTAL_URL.
 */

const ALLOWED = [
  /^\/session\/[0-9a-f-]{36}\/(start|complete|skip|swap-exercise|customize)$/,
  /^\/set-log$/,
  /^\/run-log$/,
  /^\/daily-log$/,
  /^\/habit-log$/,
  /^\/meal-log$/,
  /^\/day\/\d{4}-\d{2}-\d{2}\/(task|target-override)$/,
  /^\/checkin\/[0-9a-f-]{36}\/(submit|reply)$/,
  /^\/message$/,
  /^\/message\/[0-9a-f-]{36}\/read$/,
  /^\/day-swap$/,
  /^\/device$/,
];

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method !== "POST") return json({ error: "POST only." }, 405);

  const portal = Deno.env.get("ELVT_PORTAL_URL");
  if (!portal) return json({ error: "ELVT_PORTAL_URL is not set." }, 500);

  const token = bearer(request);
  if (!token) return json({ error: "A client token is required." }, 401);

  let payload: { path?: string; body?: unknown };
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Body must be JSON." }, 400);
  }

  const path = payload.path ?? "";
  if (!ALLOWED.some((pattern) => pattern.test(path))) {
    return json({ error: "That path is not one this function forwards." }, 400);
  }

  const response = await fetch(`${portal}/api/v1${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(payload.body ?? {}),
  });

  return new Response(await response.text(), {
    status: response.status,
    headers: { "content-type": "application/json" },
  });
});

function bearer(request: Request): string | null {
  const header = request.headers.get("authorization");
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

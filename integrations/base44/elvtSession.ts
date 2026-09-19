/**
 * elvtSession
 *
 * Paste this into a Base44 backend function. It runs on Deno.
 *
 * The client signs in with Base44's own auth. This exchanges that identity for
 * a short lived portal token scoped to one client_id, using the portal API key
 * held in Secrets. The key never leaves the backend, and the browser only ever
 * sees the token.
 *
 * The token carries client_id as a JWT claim, and the portal's row level
 * security reads that claim directly. So a token for one client cannot reach
 * another's data even if a later function asks for it, which is why the app is
 * allowed to hold it at all.
 *
 * Secrets: ELVT_PORTAL_URL, ELVT_PORTAL_API_KEY.
 */

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method !== "POST") {
    return json({ error: "POST only." }, 405);
  }

  const portal = Deno.env.get("ELVT_PORTAL_URL");
  const apiKey = Deno.env.get("ELVT_PORTAL_API_KEY");

  if (!portal || !apiKey) {
    // Named, because a function that half works is harder to debug than one
    // that refuses.
    return json({ error: "ELVT_PORTAL_URL and ELVT_PORTAL_API_KEY are not set." }, 500);
  }

  let body: { email?: string; base44_user_id?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Body must be JSON." }, 400);
  }

  if (!body.email && !body.base44_user_id) {
    return json({ error: "Send email or base44_user_id." }, 400);
  }

  const response = await fetch(`${portal}/api/v1/auth/exchange`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    // The portal answers the same way for an unknown client and an archived
    // one, so this endpoint cannot be used to find out who is on the roster.
    // Passing its status through keeps that true.
    return json({ error: "Could not start a session." }, response.status);
  }

  const session = await response.json();

  return json({
    token: session.token,
    expires_in: session.expires_in,
    client_id: session.client_id,
    slug: session.slug,
  });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * elvtGet
 *
 * Paste this into a Base44 backend function. It runs on Deno.
 *
 * Forwards a read to the portal with the client's token. Base44 stores nothing
 * but that token: the portal is the truth, and mirroring client data into
 * Base44's own store is how the two drift apart and a client reads yesterday's
 * plan.
 *
 * Secrets: ELVT_PORTAL_URL.
 */

/**
 * The paths this function will forward.
 *
 * An allow list rather than a pass through. The path arrives from the browser,
 * and a function that forwards anything is a function that forwards
 * /auth/exchange with whatever headers it was handed.
 */
const ALLOWED = [
  /^\/me$/,
  /^\/today$/,
  /^\/week\/\d+$/,
  /^\/program$/,
  /^\/session\/[0-9a-f-]{36}$/,
  /^\/exercise\/[0-9a-f-]{36}\/history$/,
  /^\/nutrition\/\d{4}-\d{2}-\d{2}$/,
  /^\/progress$/,
  /^\/checkins$/,
  /^\/messages$/,
  /^\/milestones$/,
];

Deno.serve(async (request: Request): Promise<Response> => {
  const portal = Deno.env.get("ELVT_PORTAL_URL");
  if (!portal) return json({ error: "ELVT_PORTAL_URL is not set." }, 500);

  const token = bearer(request);
  if (!token) return json({ error: "A client token is required." }, 401);

  const url = new URL(request.url);
  const path = url.searchParams.get("path") ?? "";
  const query = url.searchParams.get("query") ?? "";

  if (!ALLOWED.some((pattern) => pattern.test(path))) {
    return json({ error: "That path is not one this function forwards." }, 400);
  }

  const response = await fetch(`${portal}/api/v1${path}${query ? `?${query}` : ""}`, {
    headers: { authorization: `Bearer ${token}` },
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

import { expect, test } from "@playwright/test";
import { CLIENT_EMAIL, requireAuthStack } from "./helpers";

test.beforeAll(async () => {
  await requireAuthStack();
});

const KEY = process.env.PORTAL_API_KEY ?? "";

test.describe("POST /api/v1/auth/exchange", () => {
  test("returns a client scoped token for a known client", async ({ request }) => {
    const res = await request.post("/api/v1/auth/exchange", {
      headers: { "x-api-key": KEY },
      data: { email: CLIENT_EMAIL },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.token).toBeTruthy();
    expect(body.client_id).toBeTruthy();
    expect(body.expires_in).toBeGreaterThan(0);
  });

  test("gives an unknown email the same answer as a wrong key", async ({ request }) => {
    const res = await request.post("/api/v1/auth/exchange", {
      headers: { "x-api-key": KEY },
      data: { email: "nobody@elvt.test" },
    });
    expect(res.status()).toBe(401);
  });

  test("the token it returns is scoped to one client at the RLS layer", async ({ request }) => {
    const res = await request.post("/api/v1/auth/exchange", {
      headers: { "x-api-key": KEY },
      data: { email: CLIENT_EMAIL },
    });
    const { token, client_id } = await res.json();

    // Used directly against PostgREST, the token must reach exactly one client.
    const rows = await request.get(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/clients?select=id`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
          Authorization: `Bearer ${token}`,
        },
      },
    );
    const body = await rows.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(client_id);
  });
});

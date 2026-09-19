import { expect, test } from "@playwright/test";
import { COACH_EMAIL, COACH_PASSWORD, requireAuthStack } from "./helpers";

/**
 * The canary for "a migration broke login".
 *
 * This talks to GoTrue directly. No browser, no app code, no cookies. If this
 * fails, sign in is broken at the database level and nothing above it can
 * work, so it should be the first thing anyone reads in a failing run.
 *
 * It exists because a migration once left GoTrue unable to read its own schema
 * and the whole suite still reported 75 passed. The failure surfaced days later
 * as a login that did not work.
 *
 * The two failure modes mean completely different things and are reported
 * separately on purpose:
 *
 *   500 "Database error ..."  the schema or its grants are broken
 *   400 invalid credentials   the account or its password is wrong
 */

test.beforeAll(async () => {
  await requireAuthStack();
});

test.describe("GoTrue password grant", () => {
  test("issues a token for the seeded coach", async ({ request }) => {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "")}/auth/v1/token?grant_type=password`;

    const res = await request.post(url, {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        "Content-Type": "application/json",
      },
      data: { email: COACH_EMAIL, password: COACH_PASSWORD },
      failOnStatusCode: false,
    });

    const status = res.status();
    const body = await res.text();

    if (status >= 500) {
      throw new Error(
        [
          "",
          "GoTrue cannot read its own schema. This is a migration or grant",
          "problem, not a credentials problem.",
          "",
          `  HTTP ${status}`,
          `  ${body}`,
          "",
          "Run `npm run auth:diagnose`. Section 3 names the auth table that",
          "GoTrue's role can no longer read.",
          "",
        ].join("\n"),
      );
    }

    if (status === 400) {
      throw new Error(
        [
          "",
          `GoTrue refused ${COACH_EMAIL}. The schema is fine; the account is not.`,
          "",
          `  ${body}`,
          "",
          "Run `npm run db:reset`, which creates the accounts through GoTrue's",
          "admin API, then `npm run auth:smoke`.",
          "",
        ].join("\n"),
      );
    }

    expect(status).toBe(200);
    expect(body).toContain("access_token");
  });

  test("refuses a wrong password with 400, not 500", async ({ request }) => {
    // A 500 here would mean the rejection path is also broken, which would
    // make the passing "wrong password is refused" test meaningless.
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "")}/auth/v1/token?grant_type=password`;

    const res = await request.post(url, {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        "Content-Type": "application/json",
      },
      data: { email: COACH_EMAIL, password: "NotThePassword1" },
      failOnStatusCode: false,
    });

    expect(res.status()).toBe(400);
  });
});

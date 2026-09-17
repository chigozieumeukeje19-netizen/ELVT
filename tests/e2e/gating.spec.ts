import { expect, test } from "@playwright/test";

/**
 * These need the app but not Supabase Auth: a request with no session never
 * reaches the auth server, so they run anywhere the app boots. They cover the
 * role middleware's signed out branch and the exchange endpoint's API key
 * check, which is the part that runs before any database call.
 */

test.describe("signed out", () => {
  test("is sent to the coach sign in page", async ({ page }) => {
    await page.goto("/coach/queue");
    await expect(page).toHaveURL(/\/login/);
  });

  test("is sent to the client sign in page", async ({ page }) => {
    await page.goto("/client/today");
    await expect(page).toHaveURL(/\/client\/login/);
  });

  test("keeps where the user was going", async ({ page }) => {
    await page.goto("/coach/queue");
    await expect(page).toHaveURL(/next=%2Fcoach%2Fqueue/);
  });

  test("keeps the exercise review screen behind the coach gate", async ({ page }) => {
    await page.goto("/coach/builder/exercises/review");
    await expect(page).toHaveURL(/\/login/);
  });

  test("leaves the sign in pages reachable", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Coach sign in");

    await page.goto("/client/login");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Sign in");
  });
});

test.describe("POST /api/v1/auth/exchange", () => {
  test("refuses a request with no API key", async ({ request }) => {
    const res = await request.post("/api/v1/auth/exchange", {
      data: { email: "nadia.brookes@elvt.test" },
    });
    expect(res.status()).toBe(401);
  });

  test("refuses a request with the wrong API key", async ({ request }) => {
    const res = await request.post("/api/v1/auth/exchange", {
      headers: { "x-api-key": "not-the-key" },
      data: { email: "nadia.brookes@elvt.test" },
    });
    expect(res.status()).toBe(401);
  });

  test("refuses a key of the right length but the wrong value", async ({ request }) => {
    const res = await request.post("/api/v1/auth/exchange", {
      headers: { "x-api-key": "local-portal-XXX" },
      data: { email: "nadia.brookes@elvt.test" },
    });
    expect(res.status()).toBe(401);
  });
});

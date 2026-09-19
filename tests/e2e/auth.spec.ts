import { expect, test } from "@playwright/test";
import {
  CLIENT_EMAIL,
  CLIENT_EMAIL_2,
  CLIENT_NAME,
  COACH_EMAIL,
  clearMailbox,
  followMagicLink,
  requestMagicLink,
  requireAuthStack,
  signInAsCoach,
} from "./helpers";

test.beforeAll(async () => {
  await requireAuthStack();
});

test.describe("coach", () => {
  test("signs in with email and password and lands on the queue", async ({ page }) => {
    await signInAsCoach(page);

    await expect(page).toHaveURL(/\/coach\/queue/);
    await expect(page.getByTestId("queue-count")).toBeVisible();
  });

  test("is refused with the wrong password", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(COACH_EMAIL);
    await page.getByLabel("Password").fill("NotThePassword1");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("cannot reach the client area", async ({ page }) => {
    await signInAsCoach(page);
    await expect(page).toHaveURL(/\/coach\/queue/);

    await page.goto("/client/today");
    await expect(page).toHaveURL(/\/coach\/queue/);
  });

  test("sees the whole roster", async ({ page }) => {
    await signInAsCoach(page);
    await expect(page).toHaveURL(/\/coach\/queue/);

    await page.goto("/coach/clients");
    // The eight synthetic clients from the seed.
    await expect(page.getByTestId("roster-row")).toHaveCount(8);
  });
});

/**
 * The client path goes through the real email.
 *
 * Not the admin generateLink API. That returns a link with no PKCE code
 * verifier behind it, so GoTrue's verify endpoint answers with tokens in the
 * URL fragment, and /auth/callback reads a `code` query parameter it would
 * never receive. Driving the login form creates the verifier the same way a
 * client's phone does, and the link that lands in Mailpit is the one that
 * actually works.
 */
test.describe("client", () => {
  test("signs in with a magic link and sees only their own program", async ({ page }, testInfo) => {
    await clearMailbox();

    const link = await requestMagicLink(page, CLIENT_EMAIL);
    await followMagicLink(page, link, testInfo);

    await expect(page).toHaveURL(/\/client\/today/);
    await expect(page.getByTestId("client-greeting")).toContainText(CLIENT_NAME);
  });

  test("cannot reach the coach area", async ({ page }, testInfo) => {
    // A different client, so the two magic link requests cannot trip GoTrue's
    // per address frequency limit when these run in parallel.
    const link = await requestMagicLink(page, CLIENT_EMAIL_2);
    await followMagicLink(page, link, testInfo);
    await expect(page).toHaveURL(/\/client\/today/);

    await page.goto("/coach/queue");
    await expect(page).toHaveURL(/\/client\/today/);
  });
});

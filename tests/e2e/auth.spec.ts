import { expect, test } from "@playwright/test";
import {
  CLIENT_EMAIL,
  CLIENT_EMAIL_2,
  CLIENT_NAME,
  COACH_EMAIL,
  COACH_PASSWORD,
  clearMailbox,
  magicLinkFromMailbox,
  requireAuthStack,
} from "./helpers";

test.beforeAll(async () => {
  await requireAuthStack();
});

test.describe("coach", () => {
  test("signs in with email and password and lands on the queue", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Email").fill(COACH_EMAIL);
    await page.getByLabel("Password").fill(COACH_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

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
    await page.goto("/login");
    await page.getByLabel("Email").fill(COACH_EMAIL);
    await page.getByLabel("Password").fill(COACH_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/coach\/queue/);

    await page.goto("/client/today");
    await expect(page).toHaveURL(/\/coach\/queue/);
  });

  test("sees the whole roster", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(COACH_EMAIL);
    await page.getByLabel("Password").fill(COACH_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
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
  test("signs in with a magic link and sees only their own program", async ({ page }) => {
    await clearMailbox();

    await page.goto("/client/login");
    await page.getByLabel("Email").fill(CLIENT_EMAIL);
    await page.getByRole("button", { name: "Send my link" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Check your email",
    );

    const link = await magicLinkFromMailbox(CLIENT_EMAIL);
    await page.goto(link);

    await expect(page).toHaveURL(/\/client\/today/);
    await expect(page.getByTestId("client-greeting")).toContainText(CLIENT_NAME);
  });

  test("cannot reach the coach area", async ({ page }) => {
    // A different client, so the two magic link requests cannot trip GoTrue's
    // per address frequency limit when these run in parallel.
    await page.goto("/client/login");
    await page.getByLabel("Email").fill(CLIENT_EMAIL_2);
    await page.getByRole("button", { name: "Send my link" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Check your email",
    );

    const link = await magicLinkFromMailbox(CLIENT_EMAIL_2);
    await page.goto(link);
    await expect(page).toHaveURL(/\/client\/today/);

    await page.goto("/coach/queue");
    await expect(page).toHaveURL(/\/client\/today/);
  });
});

import { expect, test } from "@playwright/test";
import {
  CLIENT_EMAIL,
  COACH_EMAIL,
  COACH_PASSWORD,
  SKIP_REASON,
  magicLinkFor,
  supabaseIsUp,
} from "./helpers";

test.beforeAll(async () => {
  const up = await supabaseIsUp();
  test.skip(
    !up,
    SKIP_REASON,
  );
});

test.describe("coach", () => {
  test("signs in with email and password and lands on the queue", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Email").fill(COACH_EMAIL);
    await page.getByLabel("Password").fill(COACH_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/coach\/queue/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Good morning");

    // The coach reads the whole roster: eight synthetic clients.
    await expect(page.getByTestId("roster").locator("li")).toHaveCount(8);
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
});

test.describe("client", () => {
  test("signs in with a magic link and sees only their own program", async ({ page }) => {
    const link = await magicLinkFor(CLIENT_EMAIL);
    await page.goto(link);

    await expect(page).toHaveURL(/\/client\/today/);
    await expect(page.getByTestId("client-greeting")).toContainText("Nadia");
  });

  test("cannot reach the coach area", async ({ page }) => {
    const link = await magicLinkFor(CLIENT_EMAIL);
    await page.goto(link);
    await expect(page).toHaveURL(/\/client\/today/);

    await page.goto("/coach/queue");
    await expect(page).toHaveURL(/\/client\/today/);
  });
});

import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * The generated client app, driven in a real browser.
 *
 * The non negotiables in item 18 are runtime behaviour. Whether render scrolls,
 * whether one broken card takes the page, whether last Tuesday shows last
 * Tuesday's countdown: a static audit cannot see any of it, and every one of
 * these went wrong in a v1 app at least once.
 *
 * The file under test is the real generator's output, built by
 * npm run export:fixture.
 */

const FIXTURE = path.resolve(__dirname, "fixtures/client-app.html");

/**
 * A real http origin, not setContent.
 *
 * setContent leaves the page on about:blank, where the browser refuses
 * localStorage, and the offline queue and the legacy saved state case are both
 * entirely about localStorage. The file is still served as one static document
 * with nothing else on the origin, which is the claim being tested.
 */
const ORIGIN = "http://127.0.0.1:3000";
const FIXTURE_URL = `${ORIGIN}/__client-app-fixture`;

async function serveApp(page: Page, html: string) {
  await page.route(FIXTURE_URL, (route) =>
    route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html }),
  );
  await page.goto(FIXTURE_URL, { waitUntil: "domcontentloaded" });
}

async function openApp(page: Page) {
  await serveApp(page, readFileSync(FIXTURE, "utf8"));
  await expect(page.locator('[data-card="goal"]')).toBeVisible();
}

test.use({ viewport: { width: 390, height: 844 } });

test.describe("the generated client app", () => {
  test("opens with no network at all", async ({ page }) => {
    // Everything except the document itself is refused, so nothing it renders
    // can have come from a second request.
    await page.route("**/*", (route) =>
      route.request().url() === FIXTURE_URL ? route.fallback() : route.abort(),
    );
    await openApp(page);
    await expect(page.locator('[data-card="training"]')).toContainText("Goblet Squat");
  });

  test("renders its cards in the fixed order", async ({ page }) => {
    await openApp(page);
    const order = await page
      .locator("[data-card]")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-card")));

    expect(order).toEqual([
      "goal", "weeks", "days", "profile", "training",
      "nutrition", "trackers", "monday", "past", "reference",
    ].filter((card) => order.includes(card)));
  });

  test("never scrolls the page when it re-renders", async ({ page }) => {
    await openApp(page);

    // Down the page, into the nutrition card, the way a client mid session is.
    await page.evaluate(() => window.scrollTo(0, 400));
    const before = await page.evaluate(() => window.scrollY);
    expect(before).toBeGreaterThan(200);

    // Tick a meal, which re-renders everything.
    await page.locator("[data-meal]").first().click();
    await page.waitForTimeout(50);

    const after = await page.evaluate(() => window.scrollY);
    // The whole DOM was replaced and the position survived it.
    expect(Math.abs(after - before)).toBeLessThanOrEqual(2);
  });

  test("keeps a logged weight when the page re-renders", async ({ page }) => {
    await openApp(page);
    const input = page.locator("[data-log]").first();
    await input.fill("135");
    await input.blur();
    await page.locator("[data-meal]").first().click();
    await page.waitForTimeout(50);
    await expect(page.locator("[data-log]").first()).toHaveValue("135");
  });

  test("puts a weight box on rep based work and nowhere else", async ({ page }) => {
    await openApp(page);

    const squat = page.locator('[data-exercise^="e-"]').first();
    expect(await squat.locator("[data-log]").count()).toBe(3);

    // The dead hang is timed. No box.
    const hang = page.locator('[data-exercise^="h-"]').first();
    expect(await hang.locator("[data-log]").count()).toBe(0);
  });

  test("puts no weight box on a rest day", async ({ page }) => {
    await openApp(page);
    // The last day of week 1 is a rest day.
    await page.locator("[data-date]").last().click();
    await page.waitForTimeout(50);
    await expect(page.locator('[data-card="training"]')).toContainText("Rest day");
    expect(await page.locator("[data-log]").count()).toBe(0);
  });

  test("has no notes field anywhere", async ({ page }) => {
    await openApp(page);
    // Standing ELVT rule: the apps are pure accountability and all coaching
    // data comes from check-ins.
    expect(await page.locator("textarea").count()).toBe(0);
  });

  test("shows the countdown for the day being viewed, not for today", async ({ page }) => {
    await openApp(page);
    const first = await page.locator('[data-card="goal"] .num').first().innerText();

    // Two weeks later in the program.
    await page.locator('[data-card="weeks"] [data-week="3"]').click();
    await page.waitForTimeout(50);
    const later = await page.locator('[data-card="goal"] .num').first().innerText();

    expect(Number(later)).toBeLessThan(Number(first));
    expect(Number(first) - Number(later)).toBe(14);
  });

  test("shows the Monday cards on the viewed Monday, not on today", async ({ page }) => {
    await openApp(page);

    // Week 1 starts on a Monday, so the first day shows them.
    await page.locator("[data-date]").first().click();
    await page.waitForTimeout(50);
    await expect(page.locator('[data-card="monday"]')).toBeVisible();

    // Tuesday does not.
    await page.locator("[data-date]").nth(1).click();
    await page.waitForTimeout(50);
    expect(await page.locator('[data-card="monday"]').count()).toBe(0);
  });

  test("switching weeks keeps what was logged in the week being left", async ({ page }) => {
    await openApp(page);

    await page.locator("[data-log]").first().fill("135");
    await page.locator("[data-log]").first().blur();
    await page.waitForTimeout(50);

    await page.locator('[data-card="weeks"] [data-week="2"]').click();
    await page.waitForTimeout(50);
    // A fresh week, nothing carried across.
    await expect(page.locator("[data-log]").first()).toHaveValue("");

    await page.locator('[data-card="weeks"] [data-week="1"]').click();
    await page.waitForTimeout(50);
    await expect(page.locator("[data-log]").first()).toHaveValue("135");
  });

  test("archives the week it is leaving before loading the next", async ({ page }) => {
    // The assertion above passes even with no archive at all, because logs are
    // keyed by date and never collide across weeks. This one reads the archive
    // itself, which is what the rule is actually about: the week being left is
    // written down before the next one is loaded.
    await openApp(page);

    await page.locator("[data-log]").first().fill("135");
    await page.locator("[data-log]").first().blur();
    await page.waitForTimeout(50);

    await page.locator('[data-card="weeks"] [data-week="2"]').click();
    await page.waitForTimeout(50);

    const archived = await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem("elvt:fixture-client") || "{}");
      return state.archive?.["1"] ?? null;
    });

    expect(archived).not.toBeNull();
    expect(Object.values(archived.logs)).toContainEqual({ weight: 135 });
  });

  test("one broken card does not take the page with it", async ({ page }) => {
    await serveApp(
      page,
      readFileSync(FIXTURE, "utf8").replace(
        "function cardNutrition() {",
        "function cardNutrition() { throw new Error('broken');",
      ),
    );

    // The broken one says so, and everything after it still rendered.
    await expect(page.locator('[data-card="nutrition"].err')).toBeVisible();
    await expect(page.locator('[data-card="trackers"]')).toBeVisible();
    await expect(page.locator('[data-card="reference"]')).toBeVisible();
    await expect(page.locator('[data-card="training"]')).toContainText("Goblet Squat");
  });

  test("older saved state still opens", async ({ page }) => {
    await openApp(page);

    // What a client mid program has: a state written before several of the keys
    // this version reads existed.
    await page.evaluate(() => {
      localStorage.setItem(
        "elvt:fixture-client",
        JSON.stringify({ viewedWeek: 2, logs: { old: { weight: 100 } } }),
      );
    });

    await openApp(page);

    // Not just visible: an error card is visible too, and the first version of
    // this assertion passed on a page where nutrition had thrown because the
    // saved state had no meals key.
    expect(await page.locator("[data-card].err").count()).toBe(0);
    await expect(page.locator('[data-card="nutrition"]')).toContainText("Breakfast");
    await expect(page.locator('[data-card="training"]')).toContainText("Goblet Squat");

    // Nothing is written on open, so the saved copy is still the old shape
    // until the client does something. One tick, then read it back.
    await page.locator("[data-meal]").first().click();
    await page.waitForTimeout(50);

    const state = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("elvt:fixture-client") || "{}"),
    );

    // The saved week was honored, and the keys the older state never had are
    // there, which is what stops the cards throwing.
    expect(state.viewedWeek).toBe(2);
    expect(state.meals).toBeDefined();
    expect(state.trackers).toBeDefined();
    expect(state.archive).toBeDefined();
    expect(Array.isArray(state.queue)).toBe(true);
    // And the log the older state did carry survived the merge.
    expect(state.logs.old).toEqual({ weight: 100 });
  });

  test("a corrupt saved state does not stop it opening", async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => localStorage.setItem("elvt:fixture-client", "not json"));
    await openApp(page);
    await expect(page.locator('[data-card="training"]')).toBeVisible();
  });

  test("queues a log when offline and drains it when the connection returns", async ({ page }) => {
    let attempts = 0;
    await page.route("**/api/v1/**", (route) => {
      attempts += 1;
      return route.fulfill({ status: 200, body: "{}" });
    });

    await openApp(page);

    await page.evaluate(() =>
      Object.defineProperty(navigator, "onLine", { value: false, configurable: true }),
    );

    await page.locator("[data-log]").first().fill("140");
    await page.locator("[data-log]").first().blur();
    await page.waitForTimeout(50);

    const queued = await page.evaluate(
      () => JSON.parse(localStorage.getItem("elvt:fixture-client") || "{}").queue?.length ?? 0,
    );
    expect(queued).toBeGreaterThan(0);

    // And no request was attempted. Without the offline branch the queue still
    // fills, because the failed fetch's catch queues it, so counting the queue
    // alone proves nothing.
    expect(attempts).toBe(0);
  });

  test("every movement links to a video", async ({ page }) => {
    await openApp(page);
    const links = page.locator(".vid");
    expect(await links.count()).toBeGreaterThan(0);
    for (const href of await links.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("href")),
    )) {
      expect(href).toMatch(/^https:\/\/www\.youtube\.com\/watch\?v=.+/);
    }
  });

  test("every tap target clears 44px on a phone", async ({ page }) => {
    await openApp(page);
    const small = await page.evaluate(() => {
      const bad: string[] = [];
      for (const el of Array.from(
        document.querySelectorAll<HTMLElement>("button, input, a.vid, summary"),
      )) {
        const rect = el.getBoundingClientRect();
        if (rect.height > 0 && rect.height < 44) {
          bad.push(`${el.tagName} ${Math.round(rect.height)}px`);
        }
      }
      return bad;
    });
    expect(small).toEqual([]);
  });

  test("the page never scrolls sideways", async ({ page }) => {
    await openApp(page);
    const sideways = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(sideways).toBe(false);
  });
});

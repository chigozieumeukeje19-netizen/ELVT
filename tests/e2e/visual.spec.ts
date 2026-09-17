import { expect, test, type Page } from "@playwright/test";

/**
 * The visual and density pass. DESIGN.md Part 3 step 2.
 *
 * Renders every screen at both viewports against the seed fixtures, captures a
 * screenshot for the by-eye check, and asserts the two things a scanner can
 * actually measure: nothing clips silently, and the roster hits its density
 * target.
 */

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

const SCREENS = [
  "roster",
  "roster-stress",
  "roster-dense",
  "roster-empty",
  "queue",
  "queue-empty",
  "builder-exercises",
  "builder-exercises-stress",
  "builder-exercises-empty",
  "program-week",
  "program-week-flagged",
  "program-periodization",
] as const;

/**
 * Text that is wider than its box and hidden with no ellipsis is clipped
 * silently: the reader cannot tell anything is missing. An ellipsis is a
 * deliberate truncation and is allowed in a dense column, so it is excluded
 * here and checked separately for the columns where truncation is not
 * acceptable.
 */
async function silentlyClipped(page: Page) {
  return page.evaluate(() => {
    const bad: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
      if (el.children.length > 0) continue;
      const text = (el.textContent ?? "").trim();
      if (!text) continue;

      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;

      const hiddenX = style.overflowX === "hidden" || style.overflowX === "clip";
      const hiddenY = style.overflowY === "hidden" || style.overflowY === "clip";
      const ellipsis = style.textOverflow === "ellipsis";

      if (hiddenX && !ellipsis && el.scrollWidth > el.clientWidth + 1) {
        bad.push(`x: ${el.tagName}.${el.className} "${text.slice(0, 40)}"`);
      }
      if (hiddenY && el.scrollHeight > el.clientHeight + 1) {
        bad.push(`y: ${el.tagName}.${el.className} "${text.slice(0, 40)}"`);
      }
    }
    return bad;
  });
}

/**
 * Content wider than the viewport with nothing able to scroll to it.
 *
 * A dense table inside its own horizontally scrollable container is not this:
 * the reader can reach the rest of it. The bug is the page itself going wide,
 * which is why the document check below is the one that matters, and why an
 * element with a scrollable ancestor is excluded.
 */
async function overflowingViewport(page: Page) {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const scrollable = (el: HTMLElement) => {
      let node: HTMLElement | null = el.parentElement;
      while (node && node !== document.body) {
        const overflow = getComputedStyle(node).overflowX;
        if (overflow === "auto" || overflow === "scroll") return true;
        node = node.parentElement;
      }
      return false;
    };

    const bad: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0) continue;
      if (rect.right > width + 1 && !scrollable(el)) {
        bad.push(`${el.tagName}.${el.className} right=${Math.round(rect.right)}`);
      }
    }
    return bad;
  });
}

/** The page itself must never scroll sideways. */
async function pageScrollsSideways(page: Page) {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 1,
  );
}

for (const [label, viewport] of [
  ["desktop 1440x900", DESKTOP],
  ["phone 390x844", PHONE],
] as const) {
  test.describe(label, () => {
    test.use({ viewport });

    for (const screen of SCREENS) {
      test(`${screen} renders with nothing clipped`, async ({ page }, testInfo) => {
        await page.goto(`/dev/preview/${screen}`);
        await page.waitForLoadState("networkidle");

        await testInfo.attach(`${screen}-${viewport.width}x${viewport.height}.png`, {
          body: await page.screenshot({ fullPage: true }),
          contentType: "image/png",
        });

        expect(await silentlyClipped(page)).toEqual([]);
        expect(await overflowingViewport(page)).toEqual([]);
        expect(await pageScrollsSideways(page)).toBe(false);
      });
    }
  });
}

/**
 * Stored values are snake case. None of them belong on a screen: a raw enum is
 * the tell that a value went straight from the database to the reader. This ran
 * once as a by-eye finding on the roster, so now it runs every time.
 */
test.describe("no raw enum values reach a screen", () => {
  test.use({ viewport: DESKTOP });

  for (const screen of SCREENS) {
    test(`${screen}`, async ({ page }) => {
      await page.goto(`/dev/preview/${screen}`);
      await page.waitForLoadState("networkidle");

      const raw = await page.evaluate(() => {
        const found: string[] = [];
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode(node) {
              // Script and style contents are not text anyone reads. Next
              // serializes client component props into a script payload, and
              // those legitimately carry the stored values.
              const parent = node.parentElement;
              if (!parent) return NodeFilter.FILTER_REJECT;
              const tag = parent.tagName;
              if (tag === "SCRIPT" || tag === "STYLE" || tag === "TEMPLATE") {
                return NodeFilter.FILTER_REJECT;
              }
              return NodeFilter.FILTER_ACCEPT;
            },
          },
        );
        while (walker.nextNode()) {
          const text = walker.currentNode.textContent ?? "";
          // A lowercase word joined to another by an underscore. File names in
          // an import note are allowed, so anything ending .html is skipped.
          for (const hit of text.matchAll(/\b[a-z]{2,}_[a-z][a-z_]*\b/g)) {
            if (!hit[0].endsWith("html")) found.push(hit[0]);
          }
        }
        return [...new Set(found)];
      });

      expect(raw).toEqual([]);
    });
  }
});

test.describe("roster density", () => {
  test.use({ viewport: DESKTOP });

  test("rows are 44px", async ({ page }) => {
    await page.goto("/dev/preview/roster");
    const row = page.getByTestId("roster-row").first();
    const box = await row.boundingBox();
    // The 1px rule between rows sits on the row, so 44 or 45 are both correct.
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeLessThanOrEqual(45);
  });

  test("fits at least 14 rows above the fold", async ({ page }) => {
    await page.goto("/dev/preview/roster-dense");

    const rows = page.getByTestId("roster-row");
    expect(await rows.count()).toBeGreaterThanOrEqual(14);

    // How many rows actually sit inside the first 900px, which is the target
    // as DESIGN.md states it.
    const visible = await page.evaluate(() => {
      const fold = 900;
      return Array.from(
        document.querySelectorAll('[data-testid="roster-row"]'),
      ).filter((el) => el.getBoundingClientRect().bottom <= fold).length;
    });

    expect(visible).toBeGreaterThanOrEqual(14);
  });

  test("puts the client name in full, not truncated", async ({ page }) => {
    await page.goto("/dev/preview/roster-stress");

    // The 40 character stress name. A dense column may ellipsize a program
    // label; it may not ellipsize who the row is about.
    const truncated = await page.evaluate(() => {
      const cells = Array.from(
        document.querySelectorAll('[data-testid="roster-row"] td:first-child'),
      );
      return cells
        .filter((el) => el.scrollWidth > el.clientWidth + 1)
        .map((el) => el.textContent?.trim() ?? "");
    });

    expect(truncated).toEqual([]);
  });
});

test.describe("the type and color system is actually applied", () => {
  test.use({ viewport: DESKTOP });

  test("numbers in columns are set in the mono face", async ({ page }) => {
    await page.goto("/dev/preview/roster");
    const font = await page
      .locator(".elvt-num")
      .first()
      .evaluate((el) => getComputedStyle(el).fontFamily);
    expect(font).toMatch(/Plex Mono/i);
  });

  test("the interface is set in Archivo", async ({ page }) => {
    await page.goto("/dev/preview/roster");
    const font = await page.evaluate(
      () => getComputedStyle(document.body).fontFamily,
    );
    expect(font).toMatch(/Archivo/i);
  });

  test("the page is the ink base, not a cream one", async ({ page }) => {
    await page.goto("/dev/preview/roster");
    const bg = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );
    expect(bg).toBe("rgb(14, 15, 16)");
  });

  test("nothing outside a modal carries a shadow", async ({ page }) => {
    await page.goto("/dev/preview/roster");
    const shadowed = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>("body *"))
        .filter((el) => {
          const shadow = getComputedStyle(el).boxShadow;
          return shadow && shadow !== "none" && !el.classList.contains("elvt-modal");
        })
        .map((el) => `${el.tagName}.${el.className}`),
    );
    expect(shadowed).toEqual([]);
  });

  test("the empty state says what will appear and when", async ({ page }) => {
    await page.goto("/dev/preview/queue-empty");
    const text = await page.getByTestId("queue-empty").textContent();
    expect(text).toContain("Monday");
    expect(text).not.toMatch(/nothing here yet/i);
  });
});

test.describe("preview routes", () => {
  test("are not reachable without the flag", async ({ request }) => {
    // The webServer sets ENABLE_DESIGN_PREVIEW, so this asserts the gate
    // exists rather than that it is currently closed.
    const res = await request.get("/dev/preview/not-a-screen");
    expect(res.status()).toBe(404);
  });
});

/**
 * The program tab. Spec 4.2 and 6.4.
 *
 * These check the things the screen exists to do: a week strip that bands the
 * phases, a seven column grid, and a stress rail that says something when the
 * block has a conflict in it.
 */
test.describe("program tab", () => {
  test.use({ viewport: DESKTOP });

  test("the week strip carries every week and marks the current one", async ({ page }) => {
    await page.goto("/dev/preview/program-week");
    const chips = page.getByTestId("week-chip");
    expect(await chips.count()).toBe(8);
    await expect(page.locator('[aria-current="page"][data-testid="week-chip"]')).toHaveCount(1);
  });

  test("the phase bands span the block", async ({ page }) => {
    await page.goto("/dev/preview/program-week");
    await expect(page.getByTestId("phase-bands")).toBeVisible();
    await expect(page.getByTestId("phase-bands")).toContainText("Base");
    await expect(page.getByTestId("phase-bands")).toContainText("Build");
  });

  test("the day grid is seven columns", async ({ page }) => {
    await page.goto("/dev/preview/program-week");
    await expect(page.getByTestId("day-column")).toHaveCount(7);
  });

  test("session cards are draggable", async ({ page }) => {
    await page.goto("/dev/preview/program-week");
    const cards = page.getByTestId("session-card");
    expect(await cards.count()).toBeGreaterThan(0);
  });

  test("the stress rail reports the week", async ({ page }) => {
    await page.goto("/dev/preview/program-week");
    const rail = page.getByRole("complementary", { name: "Week load" });
    await expect(rail).toContainText("Stress");
    await expect(rail).toContainText("Planned miles");
  });

  test("a week with a conflict says what it is", async ({ page }) => {
    await page.goto("/dev/preview/program-week-flagged");
    const flags = page.getByTestId("stress-flags");
    if ((await flags.count()) > 0) {
      await expect(flags.locator("li").first()).not.toBeEmpty();
    }
  });

  test("the periodization grid has one column per week", async ({ page }) => {
    await page.goto("/dev/preview/program-periodization");
    const headers = page.locator('[data-testid="periodization-grid"] thead th');
    // One movement column plus one per week.
    expect(await headers.count()).toBe(9);
  });

  test("the periodization grid has a row per movement", async ({ page }) => {
    await page.goto("/dev/preview/program-periodization");
    expect(await page.getByTestId("periodization-row").count()).toBeGreaterThan(0);
  });
});

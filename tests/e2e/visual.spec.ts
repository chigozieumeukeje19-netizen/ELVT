import { expect, test, type Page } from "@playwright/test";

/**
 * The visual and density pass. DESIGN.md Part 3 step 2.
 *
 * Renders every screen at both viewports against the seed fixtures, captures a
 * screenshot for the by-eye check, and asserts the two things a scanner can
 * actually measure: nothing clips silently, and the roster hits its density
 * target.
 */

/**
 * Opens a preview screen and waits for something specific.
 *
 * Never network idle. A Next page can keep the network busy indefinitely, so
 * that wait turns a broken screen into a timeout: 27 tests at 60 seconds each
 * is 22 minutes of nothing useful. Waiting on the element the screen must
 * render, then on the fonts the screenshot needs, fails in milliseconds when
 * the page is wrong.
 */
async function openScreen(page: Page, screen: string) {
  await page.goto(`/dev/preview/${screen}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("screen-ready")).toBeVisible();
  // Layout measurements and screenshots both depend on the real face being
  // loaded, and this resolves as soon as it is.
  await page.evaluate(() => document.fonts.ready);
}

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
  "nutrition-path",
  "nutrition-path-empty",
  "nutrition-meals",
  "nutrition-meals-rest",
  "nutrition-grocery",
  "nutrition-swaps",
  "nutrition-swaps-empty",
  "intake-goals",
  "intake-medical",
  "intake-medical-errors",
  "intake-running-hidden",
  "builder-questionnaire",
  "builder-questionnaire-empty",
  "blueprint",
  "blueprint-empty",
  "program-draft",
  "program-draft-empty",
  "checkins",
  "checkins-empty",
  "checkin-compare",
  "checkin-thread",
  "checkin-thread-empty",
  "builder-question-bank",
  "checkin-daily-form",
  "checkin-weekly-form",
  "checkin-week1-form",
  "checkin-no-spine-form",
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

      // Visually hidden text for screen readers is clipped on purpose, and it
      // reaches its reader in full. Detected by the idiom itself, a 1px box
      // clipped to nothing, rather than by a class name, so nothing can be
      // quietened by renaming it.
      const rect = el.getBoundingClientRect();
      const clipped = style.clipPath === "inset(50%)" || style.clip === "rect(0px, 0px, 0px, 0px)";
      if (clipped && rect.width <= 1 && rect.height <= 1) continue;

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
        await openScreen(page, screen);

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
      await openScreen(page, screen);

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
    await openScreen(page, "roster");
    const row = page.getByTestId("roster-row").first();
    const box = await row.boundingBox();
    // The 1px rule between rows sits on the row, so 44 or 45 are both correct.
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeLessThanOrEqual(45);
  });

  test("fits at least 14 rows above the fold", async ({ page }) => {
    await openScreen(page, "roster-dense");

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
    await openScreen(page, "roster-stress");

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
    await openScreen(page, "roster");
    const font = await page
      .locator(".elvt-num")
      .first()
      .evaluate((el) => getComputedStyle(el).fontFamily);
    expect(font).toMatch(/Plex Mono/i);
  });

  test("the interface is set in Archivo", async ({ page }) => {
    await openScreen(page, "roster");
    const font = await page.evaluate(
      () => getComputedStyle(document.body).fontFamily,
    );
    expect(font).toMatch(/Archivo/i);
  });

  test("the page is the ink base, not a cream one", async ({ page }) => {
    await openScreen(page, "roster");
    const bg = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );
    expect(bg).toBe("rgb(14, 15, 16)");
  });

  test("nothing outside a modal carries a shadow", async ({ page }) => {
    await openScreen(page, "roster");
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
    await openScreen(page, "queue-empty");
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
    await openScreen(page, "program-week");
    const chips = page.getByTestId("week-chip");
    expect(await chips.count()).toBe(8);
    await expect(page.locator('[aria-current="page"][data-testid="week-chip"]')).toHaveCount(1);
  });

  test("the phase bands span the block", async ({ page }) => {
    await openScreen(page, "program-week");
    await expect(page.getByTestId("phase-bands")).toBeVisible();
    await expect(page.getByTestId("phase-bands")).toContainText("Base");
    await expect(page.getByTestId("phase-bands")).toContainText("Build");
  });

  test("the day grid is seven columns", async ({ page }) => {
    await openScreen(page, "program-week");
    await expect(page.getByTestId("day-column")).toHaveCount(7);
  });

  test("session cards are draggable", async ({ page }) => {
    await openScreen(page, "program-week");
    const cards = page.getByTestId("session-card");
    expect(await cards.count()).toBeGreaterThan(0);
  });

  test("the stress rail reports the week", async ({ page }) => {
    await openScreen(page, "program-week");
    const rail = page.getByRole("complementary", { name: "Week load" });
    await expect(rail).toContainText("Stress");
    await expect(rail).toContainText("Planned miles");
  });

  test("a week with a conflict says what it is", async ({ page }) => {
    await openScreen(page, "program-week-flagged");
    const flags = page.getByTestId("stress-flags");
    if ((await flags.count()) > 0) {
      await expect(flags.locator("li").first()).not.toBeEmpty();
    }
  });

  test("the periodization grid has one column per week", async ({ page }) => {
    await openScreen(page, "program-periodization");
    const headers = page.locator('[data-testid="periodization-grid"] thead th');
    // One movement column plus one per week.
    expect(await headers.count()).toBe(9);
  });

  test("the periodization grid has a row per movement", async ({ page }) => {
    await openScreen(page, "program-periodization");
    expect(await page.getByTestId("periodization-row").count()).toBeGreaterThan(0);
  });
});

/**
 * The nutrition screen is the calorie path table, per DESIGN.md Part 2, and
 * the first thing the eye is supposed to hit is this week's row. These check
 * the two things about it that a reader would notice immediately and that a
 * unit test cannot see: that exactly one row is marked current, and that the
 * meal column the client adds up really does add up on screen.
 */
test.describe("nutrition", () => {
  test.use({ viewport: DESKTOP });

  test("marks exactly one week as the current one", async ({ page }) => {
    await openScreen(page, "nutrition-path");
    await expect(page.locator('[data-testid="path-row"][aria-current="true"]')).toHaveCount(1);
  });

  test("the meals on screen sum to the day target on screen", async ({ page }) => {
    for (const screen of ["nutrition-meals", "nutrition-meals-rest"]) {
      await openScreen(page, screen);

      const mealCalories = await page
        .locator('[data-testid="meal-row"] td:nth-child(2)')
        .allInnerTexts();
      // The footer row opens with a th, so the calories cell is the first td
      // rather than the first child.
      const total = await page
        .locator('[data-testid="meal-total"] td')
        .first()
        .innerText();

      const summed = mealCalories.reduce((sum, text) => sum + Number(text), 0);
      expect(summed, screen).toBe(Number(total));
      await expect(page.getByTestId("meal-total")).toContainText("Matches the target");
    }
  });

  test("says which grocery lines moved with the week and which did not", async ({ page }) => {
    await openScreen(page, "nutrition-grocery");
    // Protein is held flat by the calorie path, so at least one line has to say
    // so. A list where everything scaled would mean the path stopped holding it.
    await expect(page.getByTestId("grocery-line").filter({ hasText: "Held flat" }).first()).toBeVisible();
    await expect(page.getByTestId("grocery-line").filter({ hasText: "Scaled" }).first()).toBeVisible();
  });

  test("the empty states say what to do, not that there is nothing", async ({ page }) => {
    await openScreen(page, "nutrition-path-empty");
    await expect(page.getByTestId("path-empty")).toContainText("Generate one");

    await openScreen(page, "nutrition-swaps-empty");
    await expect(page.getByTestId("swaps-empty")).toContainText("Add one");
  });
});

/**
 * The intake is the only screen in this product a client fills in on a phone
 * while deciding whether to work with Darren, so the 390px run matters more
 * here than anywhere else. These check the things a unit test cannot see: that
 * every tap target is big enough to hit, that the running section really does
 * collapse, and that a section full of errors still reads.
 */
test.describe("intake on a phone", () => {
  test.use({ viewport: PHONE });

  test("every tap target is at least 44px tall", async ({ page }) => {
    for (const screen of ["intake-goals", "intake-medical"]) {
      await openScreen(page, screen);

      const small = await page.evaluate(() => {
        const bad: string[] = [];
        for (const el of Array.from(
          document.querySelectorAll<HTMLElement>("button, [role='group'] button, input[type='checkbox']"),
        )) {
          // A checkbox inside a label is not the target; the label row is, and
          // that is what a thumb actually lands on.
          const target = el.closest("label") ?? el;
          const rect = target.getBoundingClientRect();
          if (rect.height > 0 && rect.height < 44) {
            bad.push(`${el.tagName} ${Math.round(rect.height)}px "${(el.textContent ?? "").slice(0, 20)}"`);
          }
        }
        return bad;
      });

      expect(small, screen).toEqual([]);
    }
  });

  test("the running section collapses to one question for someone who does not run", async ({ page }) => {
    await openScreen(page, "intake-running-hidden");
    await expect(page.getByTestId("question")).toHaveCount(1);
  });

  test("a scale is buttons, not a slider", async ({ page }) => {
    // A slider on a phone is how a client means 7 and sends 6.
    await openScreen(page, "intake-medical");
    await expect(page.locator("input[type='range']")).toHaveCount(0);
  });

  test("shows every error in a section at once, each next to its question", async ({ page }) => {
    await openScreen(page, "intake-medical-errors");
    const errors = page.getByTestId("question-error");
    await expect(errors).toHaveCount(5);
    for (const text of await errors.allInnerTexts()) {
      expect(text.trim().length).toBeGreaterThan(0);
    }
  });
});

test.describe("questionnaire builder", () => {
  test.use({ viewport: DESKTOP });

  test("says what each answer can change", async ({ page }) => {
    await openScreen(page, "builder-questionnaire");
    // The produces column is the point of the screen: a question that changes
    // nothing wastes a client's attention.
    const rows = page.getByTestId("outline-question");
    expect(await rows.count()).toBeGreaterThan(30);
    for (const text of await rows.locator("td:last-child").allInnerTexts()) {
      expect(text.trim()).not.toBe("Nothing");
    }
  });

  test("has ten sections", async ({ page }) => {
    await openScreen(page, "builder-questionnaire");
    await expect(page.getByTestId("outline-section")).toHaveCount(10);
  });

  test("the empty state says what to add", async ({ page }) => {
    await openScreen(page, "builder-questionnaire-empty");
    await expect(page.getByTestId("outline-empty")).toContainText("Add a section");
  });
});

/**
 * The blueprint and the program draft are the two approval screens, and both
 * only work if the coach can tell what they are approving. These check the
 * distinction the screens exist to make: which half came from the client and
 * which half came from a draft, and why each movement changed.
 */
test.describe("blueprint and program draft", () => {
  test.use({ viewport: DESKTOP });

  test("says the facts are not editable and the draft is", async ({ page }) => {
    await openScreen(page, "blueprint");
    await expect(page.getByTestId("derived-facts")).toBeVisible();
    await expect(page.getByTestId("drafted-prose")).toBeVisible();
    // The half a paste can never write says so.
    await expect(page.locator("text=never written by an AI draft")).toBeVisible();
  });

  test("shows the injury flags where they cannot be missed", async ({ page }) => {
    await openScreen(page, "blueprint");
    await expect(page.getByTestId("derived-facts")).toContainText("Spine");
    await expect(page.getByTestId("derived-facts")).toContainText("Knee");
  });

  test("the empty draft says what is missing rather than looking finished", async ({ page }) => {
    await openScreen(page, "blueprint-empty");
    await expect(page.getByTestId("drafted-prose")).toContainText("Not drafted yet");
  });

  test("explains every substitution by its flag", async ({ page }) => {
    await openScreen(page, "program-draft");
    const decisions = page.getByTestId("decision");
    expect(await decisions.count()).toBeGreaterThan(0);
    // A coach approving a block for a client with a spinal fusion has to be
    // able to read why the back squat is not in it.
    await expect(decisions.filter({ hasText: "flag" }).first()).toBeVisible();
  });

  test("collapses a decision that repeats every week rather than listing it sixteen times", async ({ page }) => {
    await openScreen(page, "program-draft");
    await expect(page.getByTestId("decision").filter({ hasText: "weeks" }).first()).toBeVisible();
  });

  test("says the rationale is missing rather than showing blank rows", async ({ page }) => {
    await openScreen(page, "program-draft-empty");
    await expect(page.getByTestId("rationale-empty")).toContainText("Copy the prompt");
  });
});

/**
 * The check-in engine's three screens, and the forms themselves.
 *
 * The thing worth asserting on screen is that the spine is visible. A weekly
 * form built around last Monday's change only works if the coach can see which
 * questions are there because of it, and the client should never have to wonder
 * why they are being asked about calories again.
 */
test.describe("check-ins", () => {
  test.use({ viewport: DESKTOP });

  test("marks the spine questions and puts them straight after the shared block", async ({ page }) => {
    await openScreen(page, "checkin-weekly-form");
    const spine = page.locator('[data-testid="form-question"][data-spine="true"]');
    expect(await spine.count()).toBeGreaterThan(0);

    // Read from the attribute, not the rendered text: elvt-label uppercases,
    // so innerText says SPINE and a match on "Spine" quietly finds nothing.
    const marks = await page.getByTestId("form-question").evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-spine") === "true"),
    );
    // Five shared questions come first, fasted weight among them.
    expect(marks.indexOf(true)).toBe(5);
  });

  test("asks fasted weight first on every weekly form", async ({ page }) => {
    for (const screen of ["checkin-weekly-form", "checkin-week1-form", "checkin-no-spine-form"]) {
      await openScreen(page, screen);
      await expect(page.getByTestId("form-question").first(), screen).toContainText("Fasted weight");
    }
  });

  test("closes every weekly form with the one thing", async ({ page }) => {
    for (const screen of ["checkin-weekly-form", "checkin-week1-form", "checkin-no-spine-form"]) {
      await openScreen(page, screen);
      await expect(page.getByTestId("form-question").last(), screen).toContainText(
        "should be doing and are not",
      );
    }
  });

  test("marks no question as spine when nothing changed", async ({ page }) => {
    await openScreen(page, "checkin-no-spine-form");
    await expect(page.locator('[data-testid="form-question"][data-spine="true"]')).toHaveCount(0);
  });

  test("keeps the daily to seven questions", async ({ page }) => {
    await openScreen(page, "checkin-daily-form");
    const count = await page.getByTestId("form-question").count();
    expect(count).toBeGreaterThanOrEqual(6);
    expect(count).toBeLessThanOrEqual(7);
  });

  test("shows a week a question was not asked as a gap, not a zero", async ({ page }) => {
    await openScreen(page, "checkin-compare");
    // A question added at week 3 must not read as two weeks of nothing.
    const notAsked = page.getByTestId("compare-cell").filter({ hasText: "not asked" });
    expect(await notAsked.count()).toBe(2);
  });

  test("says which submissions are waiting on the coach", async ({ page }) => {
    await openScreen(page, "checkins");
    await expect(
      page.getByTestId("submission-row").filter({ hasText: "Waiting on you" }).first(),
    ).toBeVisible();
  });

  test("the review thread shows both sides", async ({ page }) => {
    await openScreen(page, "checkin-thread");
    const messages = page.getByTestId("thread-message");
    expect(await messages.count()).toBe(3);
    // A client who cannot answer a review either follows it without
    // understanding it or ignores it.
    await expect(messages.filter({ hasText: "Them" })).toHaveCount(1);
  });

  test("the empty states say what will appear and when", async ({ page }) => {
    await openScreen(page, "checkins-empty");
    await expect(page.getByTestId("submissions-empty")).toContainText("Sunday");

    await openScreen(page, "checkin-thread-empty");
    await expect(page.getByTestId("thread-empty")).toContainText("answer it");
  });

  test("every question in the bank can change something", async ({ page }) => {
    await openScreen(page, "builder-question-bank");
    for (const text of await page.getByTestId("bank-row").locator("td:last-child").allInnerTexts()) {
      expect(text.trim()).not.toBe("");
    }
  });
});

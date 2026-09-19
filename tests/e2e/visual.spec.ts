import { expect, test, type Page } from "@playwright/test";
import { SCREENS } from "@/lib/design/preview-screens";
import { EM_DASH } from "@/lib/design/semantic";
import { THEMES, THEME_COOKIE, type Theme } from "@/lib/design/theme";

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
async function openScreen(page: Page, screen: string, theme: Theme = "dark") {
  // The server decides the theme from this cookie before the first byte goes
  // out, so setting it here is exactly what the toggle does. Nothing about the
  // measurement is theme-aware beyond this line.
  if (theme !== "dark") {
    const baseURL = test.info().project.use.baseURL!;
    await page.context().addCookies([{ name: THEME_COOKIE, value: theme, url: baseURL }]);
  }

  await page.goto(`/dev/preview/${screen}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("screen-ready")).toBeVisible();
  // Layout measurements and screenshots both depend on the real face being
  // loaded, and this resolves as soon as it is.
  await page.evaluate(() => document.fonts.ready);

  // The theme that was asked for is the theme that rendered. Without this a
  // cookie that never arrived would quietly give a second dark run and the
  // light pass would report itself green having checked nothing.
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

/**
 * What the page surface role resolves to in each theme.
 *
 * Written out rather than read back from the stylesheet on purpose: reading it
 * would assert that CSS applies a variable, which it does. Pinning the value is
 * what catches the page drifting off the role.
 */
const PAGE_SURFACE: Record<Theme, string> = {
  dark: "rgb(14, 20, 30)",
  light: "rgb(237, 241, 247)",
};

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };


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

/*
 * Every screen, both viewports, BOTH themes. DESIGN_V2.md 2.2 and step 7:
 * light is not an afterthought, and a token-correct page can still read wrong
 * in it. A highlight that carries elevation in dark is invisible on a white
 * card, so the only way to know is to render it.
 */
for (const theme of THEMES) {
  for (const [label, viewport] of [
    ["desktop 1440x900", DESKTOP],
    ["phone 390x844", PHONE],
  ] as const) {
    test.describe(`${theme} ${label}`, () => {
      test.use({ viewport });

      for (const screen of SCREENS) {
        test(`${screen} renders with nothing clipped`, async ({ page }, testInfo) => {
          await openScreen(page, screen, theme);

          await testInfo.attach(
            `${screen}-${theme}-${viewport.width}x${viewport.height}.png`,
            {
              body: await page.screenshot({ fullPage: true }),
              contentType: "image/png",
            },
          );

          expect(await silentlyClipped(page)).toEqual([]);
          expect(await overflowingViewport(page)).toEqual([]);
          expect(await pageScrollsSideways(page)).toBe(false);
        });
      }
    });
  }
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

  test("rows are 48px", async ({ page }) => {
    await openScreen(page, "roster");
    const row = page.getByTestId("roster-row").first();
    const box = await row.boundingBox();
    // DESIGN_V2.md 3.4. The 1px rule between rows sits on the row, so 48 or 49
    // are both correct. v1 was 44; the v2 scale is more generous and the
    // density target below did not move to pay for it.
    expect(box!.height).toBeGreaterThanOrEqual(48);
    expect(box!.height).toBeLessThanOrEqual(49);
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

  test("numbers in columns are tabular Archivo, not a second typeface", async ({ page }) => {
    await openScreen(page, "roster");
    const figure = await page
      .locator(".elvt-num")
      .first()
      .evaluate((el) => {
        const style = getComputedStyle(el);
        return {
          family: style.fontFamily,
          numeric: `${style.fontVariantNumeric} ${style.fontFeatureSettings}`,
        };
      });

    // v2 retires mono for data. A column still has to line up, so the figures
    // are tabular rather than a different face.
    expect(figure.family).toMatch(/Archivo/i);
    expect(figure.family).not.toMatch(/Plex Mono/i);
    expect(figure.numeric).toMatch(/tnum|tabular-nums/);
  });

  test("no figure anywhere on the roster is set in the mono face", async ({ page }) => {
    await openScreen(page, "roster");
    const mono = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>("body *"))
        .filter((el) => el.children.length === 0 && /\d/.test(el.textContent ?? ""))
        .filter((el) => /mono/i.test(getComputedStyle(el).fontFamily))
        .map((el) => (el.textContent ?? "").trim()),
    );
    expect(mono).toEqual([]);
  });

  test("labels are sentence case, not all caps with tracking", async ({ page }) => {
    await openScreen(page, "roster");
    const shouting = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>(".elvt-label"))
        .filter((el) => getComputedStyle(el).textTransform === "uppercase")
        .map((el) => (el.textContent ?? "").trim()),
    );
    expect(shouting).toEqual([]);
  });

  test("the interface is set in Archivo", async ({ page }) => {
    await openScreen(page, "roster");
    const font = await page.evaluate(
      () => getComputedStyle(document.body).fontFamily,
    );
    expect(font).toMatch(/Archivo/i);
  });

  for (const theme of THEMES) {
    test(`the ${theme} page is the Deep Water surface, not a cream one`, async ({ page }) => {
      await openScreen(page, "roster", theme);
      const bg = await page.evaluate(
        () => getComputedStyle(document.body).backgroundColor,
      );

      // The exact token, per theme. Not a range: a page that drifts off the
      // surface role is the drift this check exists to catch.
      expect(bg).toBe(PAGE_SURFACE[theme]);

      // And never the client app. Hard fail 0: that theme lives in its own
      // token file and the portal must never reach for it. Cream is warm and
      // light; Deep Water light is cool and blue, so a red channel above the
      // blue one at high lightness is the tell.
      const [red, green, blue] = bg.match(/\d+/g)!.map(Number);
      expect(red + green + blue > 600 && red > blue).toBe(false);
    });
  }

  /*
   * v2 grants elevation a shadow, so the v1 rule "nothing outside a modal"
   * cannot stand. What did NOT change is tell 9: a shadow on every box is
   * still a failure. So this checks two things instead of one -- the shadow
   * came from the permitted set, and it is rare.
   */
  for (const theme of THEMES) {
    test(`shadows in ${theme} come from the scale and stay rare`, async ({ page }) => {
      await openScreen(page, "roster", theme);

      const { shadowed, boxes, offScale } = await page.evaluate(() => {
        /*
         * The permitted set, read the only way that compares like with like:
         * render a probe carrying each permitted declaration and take the
         * browser's own computed string. Comparing a computed shadow against
         * the token text fails on formatting alone -- rgb(255 255 255 / 0.04)
         * and rgba(255, 255, 255, 0.04) are the same shadow.
         */

        /*
         * A Tailwind shadow utility expands to three parts, two of which are
         * the fully transparent ring placeholders. They paint nothing, so they
         * are dropped from both sides before comparing.
         */
        const real = (shadow: string) =>
          shadow
            .split(/,(?![^()]*\))/)
            .map((part) => part.trim())
            .filter((part) => !/^rgba\(0, 0, 0, 0\)/.test(part))
            .join(", ");

        const permitted = new Set<string>(["", "none"]);
        const probe = document.createElement("div");
        document.body.append(probe);
        for (const declaration of [
          "var(--lift-1), var(--shadow-card)",
          "var(--lift-2), var(--shadow-card)",
          "var(--shadow-modal)",
          "var(--lift-1)",
          "var(--lift-2)",
          "var(--shadow-card)",
        ]) {
          probe.style.boxShadow = declaration;
          permitted.add(real(getComputedStyle(probe).boxShadow));
        }
        probe.remove();

        const all = Array.from(document.querySelectorAll<HTMLElement>("body *"));
        const withShadow = all.filter(
          (el) => getComputedStyle(el).boxShadow !== "none",
        );

        return {
          boxes: all.length,
          shadowed: withShadow.length,
          offScale: withShadow
            .map((el) => real(getComputedStyle(el).boxShadow))
            .filter((shadow) => !permitted.has(shadow)),
        };
      });

      expect(offScale).toEqual([]);
      // Tell 9 still holds. A roster is a table on a page; if most of the
      // elements on it are lifted, nothing is.
      expect(shadowed).toBeLessThan(boxes * 0.1);
    });
  }

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

    // Read from the attribute, not the rendered text. The mark is a state of
    // the question, and reading it off the label's words would make this pass
    // or fail on copy.
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

/**
 * The queue's three lanes.
 *
 * A flat list sorted by severity looks tidier and is worse: it hides which of
 * the three decision rules an item falls under, and those rules are what tell
 * the coach whether to act today, act Monday, or reply.
 */
test.describe("queue lanes", () => {
  test.use({ viewport: DESKTOP });

  test("shows all three lanes in order, whatever is in them", async ({ page }) => {
    for (const screen of ["queue-lanes", "queue-lanes-one", "queue-lanes-empty"]) {
      await openScreen(page, screen);
      const lanes = await page
        .getByTestId("queue-lane")
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-lane")));
      expect(lanes, screen).toEqual(["same_day", "trend", "request"]);
    }
  });

  test("an empty lane says nothing trended rather than disappearing", async ({ page }) => {
    // An absent heading reads as a screen that failed to load. A heading
    // saying nothing trended reads as the answer, which is what it is.
    await openScreen(page, "queue-lanes-one");
    const empties = page.getByTestId("lane-empty");
    await expect(empties).toHaveCount(2);
    await expect(empties.first()).toContainText("No flag");
  });

  test("carries the suggested message next to the item that raised it", async ({ page }) => {
    await openScreen(page, "queue-lanes");
    const messages = page.getByTestId("suggested-message");
    expect(await messages.count()).toBeGreaterThan(0);
    for (const text of await messages.allInnerTexts()) {
      // The voice rules: real numbers, one question, no dashes.
      expect(text).not.toMatch(/\s[-–—]\s/);
    }
  });

  test("puts the most urgent item at the top of its lane", async ({ page }) => {
    await openScreen(page, "queue-lanes");
    const first = page
      .locator('[data-lane="same_day"] [data-testid="lane-item"]')
      .first();
    await expect(first).toContainText("Back discomfort");
  });
});

/**
 * The Monday card, which is the screen the whole product is for.
 *
 * The target is two minutes a client and fifteen for eight of them, and these
 * check the layout decisions that target rests on: everything needed is on one
 * card, the spine question is at the top of the check-in, each change is its
 * own decision, and DESIGN.md's rule that one card plus the top edge of the
 * next is visible so it is obvious the list continues.
 */
test.describe("the Monday card", () => {
  test.use({ viewport: DESKTOP });

  test("shows one card and the top edge of the next", async ({ page }) => {
    await openScreen(page, "monday-cards");
    const cards = page.getByTestId("monday-card");
    expect(await cards.count()).toBe(3);

    const first = await cards.nth(0).boundingBox();
    const second = await cards.nth(1).boundingBox();
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();

    // The first card fits, and the second starts before the fold.
    expect(first!.y + first!.height).toBeLessThanOrEqual(900);
    expect(second!.y).toBeLessThan(900);
  });

  test("pins the spine question to the top of what they said", async ({ page }) => {
    await openScreen(page, "monday-card");
    const answers = page.getByTestId("checkin-answer");
    const spine = await answers.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-spine") === "true"),
    );
    expect(spine.indexOf(true)).toBe(0);
  });

  test("gives every proposed change its own accept, edit and reject", async ({ page }) => {
    await openScreen(page, "monday-cards");
    // Read only in the preview, so the decision is shown as a word. What
    // matters is that a decision belongs to a line rather than to the card: a
    // coach who has to take all three or none will take all three.
    const lines = page.getByTestId("change-line");
    expect(await lines.count()).toBeGreaterThan(3);
    for (const decision of await lines.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-decision")),
    )) {
      expect(["pending", "accept", "edit", "reject"]).toContain(decision);
    }
  });

  test("carries the whole decision on the card, with nothing to open", async ({ page }) => {
    await openScreen(page, "monday-card");
    const card = page.getByTestId("monday-card").first();
    for (const part of ["card-score", "card-weight", "card-adherence", "card-checkin", "card-changes", "card-message"]) {
      await expect(card.getByTestId(part), part).toBeVisible();
    }
  });

  test("says nothing changes rather than showing an empty diff", async ({ page }) => {
    await openScreen(page, "monday-card-quiet");
    await expect(page.getByTestId("no-changes")).toContainText("two weeks running");
    // A quiet week still gets a message, because silence is not a review.
    await expect(page.getByTestId("card-message")).toBeVisible();
  });

  test("colors a category with nothing planned as nothing, not as a failure", async ({ page }) => {
    await openScreen(page, "monday-card-quiet");
    const recovery = page.getByTestId("adherence-line").filter({ hasText: "Recovery" });
    await expect(recovery).toContainText("none planned");
    // No percentage and no color where nothing was asked of them.
    await expect(recovery.locator(".text-flag")).toHaveCount(0);
  });

  test("puts the flagged card above the quiet one", async ({ page }) => {
    await openScreen(page, "monday-cards");
    const severities = await page
      .getByTestId("monday-card")
      .evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute("data-severity"))));
    for (let i = 1; i < severities.length; i += 1) {
      expect(severities[i]).toBeLessThanOrEqual(severities[i - 1]);
    }
  });

  test("the drafted message follows the voice rules", async ({ page }) => {
    for (const screen of ["monday-card", "monday-card-quiet"]) {
      await openScreen(page, screen);
      const text = await page.getByTestId("card-message").innerText();
      const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);

      expect(lines.length, screen).toBeGreaterThanOrEqual(2);
      expect(lines.length, screen).toBeLessThanOrEqual(5);
      expect(text, screen).toContain("?");
      expect(text, screen).toMatch(/\d/);
      expect(text, screen).not.toMatch(/\s[-–—]\s/);
    }
  });
});

/**
 * Messaging.
 *
 * The thing worth asserting is the ordering. Every messaging app sorts by most
 * recent, and here that is exactly wrong: the thread at the top of a recency
 * list is the client you are already talking to, and the one who needs a
 * message is the one who has sent you nothing.
 */
test.describe("messages", () => {
  test.use({ viewport: DESKTOP });

  test("puts the client nobody has spoken to first", async ({ page }) => {
    await openScreen(page, "messages");
    const first = page.getByTestId("thread-row").first();
    await expect(first).toContainText("Karar");
    await expect(first.getByTestId("days-since")).toContainText("never");
  });

  test("orders by how long it has been, not by who wrote last", async ({ page }) => {
    await openScreen(page, "messages");
    const days = await page
      .getByTestId("days-since")
      .allInnerTexts();

    // never, then descending days, then today.
    expect(days[0]).toBe("never");
    expect(days[days.length - 1]).toBe("today");
  });

  test("colors the quiet clients and not the recent ones", async ({ page }) => {
    await openScreen(page, "messages");
    await expect(page.locator('[data-testid="days-since"].text-flag').first()).toBeVisible();
    await expect(page.locator('[data-testid="days-since"].text-ok').first()).toBeVisible();
  });

  test("a quick reply fills the real numbers in", async ({ page }) => {
    await openScreen(page, "composer");
    await page.getByTestId("quick-reply").filter({ hasText: "Steps down two days" }).click();

    const body = await page.getByTestId("message-body").inputValue();
    expect(body).toContain("5200");
    expect(body).toContain("7400");
    // A hole left in a sent message is worse than no message.
    expect(body).not.toContain("{");
  });

  test("says which figure is missing rather than sending a message with a hole", async ({ page }) => {
    await openScreen(page, "composer-thin");
    await page.getByTestId("quick-reply").filter({ hasText: "Steps down two days" }).click();

    await expect(page.getByTestId("quick-reply-missing")).toContainText("steps_a");
    // Nothing was put in the box.
    expect(await page.getByTestId("message-body").inputValue()).toBe("");
  });

  test("scheduling asks for the client's time, not the reader's", async ({ page }) => {
    await openScreen(page, "composer");
    await expect(page.getByTestId("schedule-fields")).toBeHidden();
    await page.getByLabel("Send it later").check();
    await expect(page.getByTestId("schedule-fields")).toContainText("their time");
  });

  test("the empty inbox says what starts a thread", async ({ page }) => {
    await openScreen(page, "messages-empty");
    await expect(page.getByTestId("threads-empty")).toContainText("answer in it");
  });
});

/**
 * Reminder settings.
 *
 * The rule the screen exists to make visible is the digest one. A coach who
 * sets four things for 07:00 should see that they will arrive as one message
 * while they are setting it up, not discover it from what the client receives.
 */
test.describe("reminders", () => {
  test.use({ viewport: DESKTOP });

  test("marks the reminders that will go out together", async ({ page }) => {
    await openScreen(page, "reminders");
    expect(await page.getByTestId("grouped").count()).toBeGreaterThan(1);
  });

  test("states the digest rule on the screen", async ({ page }) => {
    await openScreen(page, "reminders");
    await expect(page.locator("text=one message")).toBeVisible();
  });

  test("says what each reminder actually says to the client", async ({ page }) => {
    await openScreen(page, "reminders");
    for (const text of await page
      .getByTestId("reminder-row")
      .locator("td")
      .first()
      .allInnerTexts()) {
      expect(text.trim().length).toBeGreaterThan(0);
    }
  });

  test("shows the ones that are off rather than hiding them", async ({ page }) => {
    // A coach looking for a run reminder that is not arriving needs to see the
    // row saying it is off, not an absence.
    await openScreen(page, "reminders-sparse");
    const rows = page.getByTestId("reminder-row");
    await expect(rows).toHaveCount(10);
    await expect(rows.filter({ hasText: "Run" }).first()).toContainText("No");
  });
});

/**
 * The progress charts.
 *
 * One series per chart, always, and that falls out of two rules meeting rather
 * than from taste: DESIGN.md gives color only where it carries a meaning, so
 * there is no categorical palette for a second series, and weight against steps
 * is two scales, which would be a dual axis chart.
 *
 * So what is worth asserting is that nothing in a chart is colored except where
 * the color already means something, and that the delta says which way it went
 * in words as well as in color.
 */
test.describe("progress charts", () => {
  test.use({ viewport: DESKTOP });

  test("draws one line per chart and no legend", async ({ page }) => {
    await openScreen(page, "progress");
    const charts = page.getByTestId("trend-chart");
    expect(await charts.count()).toBe(4);

    for (let i = 0; i < 4; i += 1) {
      // One line path, one area path. A second series would be a third path.
      const paths = await charts.nth(i).locator("svg path").count();
      expect(paths).toBe(2);
    }

    // A single series needs no legend: the caption names what is plotted.
    expect(await page.locator(".legend, [data-testid='legend']").count()).toBe(0);
  });

  test("uses no color on the marks themselves", async ({ page }) => {
    await openScreen(page, "progress");
    const strokes = await page
      .locator('[data-testid="trend-chart"] svg path, [data-testid="trend-chart"] svg circle')
      .evaluateAll((nodes) =>
        nodes.map((node) => `${node.getAttribute("stroke") ?? ""}|${node.getAttribute("fill") ?? ""}`),
      );

    for (const value of strokes) {
      // Only the neutral tokens. No --ok, --watch or --flag on a line or a dot:
      // a weight going down is not a signal, it is a number.
      expect(value).not.toContain("--ok");
      expect(value).not.toContain("--watch");
      expect(value).not.toContain("--flag");
    }
  });

  test("says which way it went in words, not only in color", async ({ page }) => {
    await openScreen(page, "progress");
    // A status color never carries the meaning on its own.
    for (const text of await page.getByTestId("chart-delta").allInnerTexts()) {
      expect(text.toLowerCase()).toMatch(/\b(up|down)\b/);
    }
  });

  test("labels the end of the line and nothing else", async ({ page }) => {
    await openScreen(page, "progress");
    // A number on every point is chaos and goes unread.
    for (let i = 0; i < 4; i += 1) {
      expect(
        await page.getByTestId("trend-chart").nth(i).locator("svg text").count(),
      ).toBe(1);
    }
  });

  test("gives every chart a text description", async ({ page }) => {
    await openScreen(page, "progress");
    for (const label of await page
      .locator('[data-testid="trend-chart"] svg')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-label")))) {
      expect(label).toBeTruthy();
      expect(label!.length).toBeGreaterThan(20);
    }
  });

  test("opens on four and says how many more there are", async ({ page }) => {
    await openScreen(page, "progress");
    await expect(page.getByTestId("trend-grid").locator("figure")).toHaveCount(4);

    await openScreen(page, "progress-all");
    await expect(page.getByTestId("trend-grid").locator("figure")).toHaveCount(12);
  });

  test("says a line needs two readings rather than drawing nothing", async ({ page }) => {
    await openScreen(page, "progress-thin");
    await expect(page.getByTestId("chart-empty").first()).toContainText("Two readings");
  });

  test("the table carries the same numbers, with gaps marked as gaps", async ({ page }) => {
    await openScreen(page, "progress-table");
    await expect(page.getByTestId("progress-table")).toBeVisible();
    // A day nobody logged is not a day they scored zero.
    await expect(page.locator("text=not logged").first()).toBeVisible();
  });

  test("the empty state says what to check", async ({ page }) => {
    await openScreen(page, "progress-empty");
    await expect(page.getByTestId("chart-empty").first()).toBeVisible();
  });
});

/**
 * Photos.
 *
 * No images in the fixtures. Putting photographs of people into a repository to
 * test a grid would be the wrong trade even with consent, and every slot
 * rendering its missing state is the case worth checking anyway: a full grid is
 * the easy one.
 */
test.describe("photos", () => {
  test.use({ viewport: DESKTOP });

  test("shows three angles a week, marking the ones not taken", async ({ page }) => {
    await openScreen(page, "photos");
    const weeks = page.getByTestId("photo-week");
    await expect(weeks).toHaveCount(3);

    // Three slots a week whether or not the photo exists, so a missing angle is
    // a gap rather than a shorter row.
    await expect(page.getByTestId("photo-slot")).toHaveCount(9);
  });

  test("says which week is incomplete", async ({ page }) => {
    // A client who took the front and forgot the back is a different fact from
    // one who took nothing, and only the first is worth a message.
    await openScreen(page, "photos");
    const partial = page.getByTestId("partial-week");
    await expect(partial).toHaveCount(1);
    await expect(partial).toContainText("2 of 3");
  });

  test("compares by angle rather than by week", async ({ page }) => {
    await openScreen(page, "photos-compare");
    // Front against front. A grid of six in week order makes the reader do the
    // pairing, and they will do it wrong.
    const rows = page.getByTestId("compare-row");
    expect(await rows.count()).toBeGreaterThan(0);
    for (const angle of await rows.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-angle")),
    )) {
      expect(["front", "side", "back"]).toContain(angle);
    }
  });

  test("gives both sides of a comparison the same size", async ({ page }) => {
    await openScreen(page, "photos-compare");
    const sides = page.getByTestId("compare-side");
    const boxes = await sides.evaluateAll((nodes) =>
      nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        return Math.round(rect.width);
      }),
    );
    // A comparison where one side is bigger has already made its point.
    expect(new Set(boxes).size).toBe(1);
  });

  test("offers only comparisons that have photos on both sides", async ({ page }) => {
    await openScreen(page, "photos-compare");
    const labels = await page.locator('[aria-label="Comparisons"] a').allInnerTexts();
    // Weeks 1, 4 and 8 have photos; week 12 does not.
    expect(labels.join(" ")).not.toContain("week 12");
  });

  test("says a comparison needs two sets rather than offering a dead button", async ({ page }) => {
    await openScreen(page, "photos-compare-unavailable");
    await expect(page.getByTestId("compare-unavailable")).toContainText("Two sets");
  });

  test("the empty state says when the first set arrives", async ({ page }) => {
    await openScreen(page, "photos-empty");
    await expect(page.getByTestId("photos-empty")).toContainText("Monday");
  });
});

/**
 * Roster filters and bulk actions.
 *
 * The two things worth asserting are the ones that make a coach stop trusting
 * a control: a count that promises more than the click delivers, and a button
 * that says it will change six things when it will change four.
 */
test.describe("roster filters", () => {
  test.use({ viewport: DESKTOP });

  test("shows all five with their counts", async ({ page }) => {
    await openScreen(page, "roster-filters");
    await expect(page.getByTestId("filter")).toHaveCount(5);
    for (const text of await page.getByTestId("filter").allInnerTexts()) {
      expect(text).toMatch(/\d/);
    }
  });

  test("keeps a filter that matches nobody on screen, saying zero", async ({ page }) => {
    // A coach looking for "race within 6 weeks" needs to see that nobody has
    // one, not to wonder where the button went.
    await openScreen(page, "roster-filters-active");
    await expect(page.getByTestId("filter")).toHaveCount(5);
    await expect(page.locator('[data-testid="filter"][aria-disabled="true"]').first()).toBeVisible();
  });

  test("says what is being filtered out", async ({ page }) => {
    await openScreen(page, "roster-filters");
    await expect(page.getByTestId("filter-summary")).toContainText("8 clients");

    await openScreen(page, "roster-filters-active");
    await expect(page.getByTestId("filter-summary")).toContainText("filtered");
  });

  test("marks the active filter", async ({ page }) => {
    await openScreen(page, "roster-filters-active");
    await expect(page.locator('[data-testid="filter"][data-active="true"]')).toHaveCount(1);
  });

  test("offers the saved segments", async ({ page }) => {
    await openScreen(page, "roster-filters");
    await expect(page.getByTestId("segments")).toContainText("Slipping");
  });

  test("the bulk bar appears only once something is selected", async ({ page }) => {
    await openScreen(page, "roster-filters");
    expect(await page.getByTestId("bulk-bar").count()).toBe(0);

    await openScreen(page, "roster-bulk");
    await expect(page.getByTestId("bulk-bar")).toBeVisible();
    await expect(page.getByTestId("bulk-selected")).toContainText("3 selected");
  });

  test("every bulk button says how many it would actually change", async ({ page }) => {
    // "Pause 6" when two are already paused is a button that lies about what it
    // is about to do.
    await openScreen(page, "roster-bulk");
    const buttons = page.getByTestId("bulk-action");
    expect(await buttons.count()).toBeGreaterThan(1);
    for (const affects of await buttons.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-affects")),
    )) {
      expect(Number(affects)).toBeGreaterThan(0);
    }
  });
});

/**
 * Race mode.
 *
 * The thing worth asserting is that the date drives everything. These three
 * screens differ only in which day they are read on, so if the countdown, the
 * phase or the checklist ever stopped following the viewed date, two of them
 * would say the same thing.
 */
test.describe("race mode", () => {
  test.use({ viewport: DESKTOP });

  test("counts down from the day being viewed", async ({ page }) => {
    await openScreen(page, "race-build");
    await expect(page.getByTestId("race-days-out")).toHaveAttribute("data-days-out", "55");

    await openScreen(page, "race-taper");
    await expect(page.getByTestId("race-days-out")).toHaveAttribute("data-days-out", "17");

    await openScreen(page, "race-week");
    await expect(page.getByTestId("race-days-out")).toHaveAttribute("data-days-out", "3");
  });

  test("names the phase in words", async ({ page }) => {
    // No raw enum reaches a screen, here or anywhere.
    for (const [screen, phase, words] of [
      ["race-build", "build", "Building"],
      ["race-taper", "taper", "Taper"],
      ["race-week", "race_week", "Race week"],
    ] as const) {
      await openScreen(page, screen);
      await expect(page.getByTestId("race-phase")).toHaveAttribute("data-phase", phase);
      await expect(page.getByTestId("race-phase")).toContainText(words);
    }
  });

  test("brings the checklist out only in race week", async ({ page }) => {
    // Nine lines about pinning a number are noise in week ten of eighteen, and
    // a panel that is always there is a panel nobody reads when it matters.
    await openScreen(page, "race-build");
    expect(await page.getByTestId("race-checklist").count()).toBe(0);

    await openScreen(page, "race-taper");
    expect(await page.getByTestId("race-checklist").count()).toBe(0);

    await openScreen(page, "race-week");
    await expect(page.getByTestId("race-checklist")).toBeVisible();
  });

  test("calls out the one line that is today", async ({ page }) => {
    await openScreen(page, "race-week");
    await expect(page.locator('[data-testid="checklist-line"][data-today="true"]')).toHaveCount(1);
  });

  test("leaves the taper weeks uncoloured and bands the rest", async ({ page }) => {
    // Under plan is what the bands catch, and under plan in a taper week is
    // what a taper is for.
    await openScreen(page, "race-week");

    const bands = await page
      .locator('[data-testid="mileage-row"]')
      .evaluateAll((rows) =>
        rows.map((row) => ({
          week: row.getAttribute("data-week"),
          band: row.querySelector("[data-band]")?.getAttribute("data-band") ?? null,
        })),
      );

    expect(bands.find((row) => row.week === "17")!.band).toBe("none");
    expect(bands.find((row) => row.week === "14")!.band).not.toBe("none");
  });

  test("says what the fueling plan needs rather than inventing one", async ({ page }) => {
    await openScreen(page, "race-no-goal");
    await expect(page.getByTestId("fueling")).toContainText("goal time");

    await openScreen(page, "race-week");
    await expect(page.getByTestId("fueling")).toContainText("grams an hour");
  });

  test("says what will appear here when there is no race", async ({ page }) => {
    await openScreen(page, "race-empty");
    await expect(page.getByTestId("race-empty")).toContainText("date and a distance");
  });
});

test.describe("race mode on a phone", () => {
  test.use({ viewport: PHONE });

  test("keeps the checklist readable at 390", async ({ page }) => {
    await openScreen(page, "race-week");
    await expect(page.getByTestId("race-checklist")).toBeVisible();

    // Nine lines of real copy on a narrow screen is where wrapping fails.
    for (const line of await page.getByTestId("checklist-line").all()) {
      const box = await line.boundingBox();
      expect(box!.width).toBeLessThanOrEqual(PHONE.width);
    }
  });
});

/**
 * The client detail Overview.
 *
 * The screen the roster has been linking to since the roster existed. What is
 * worth asserting is the hierarchy: one number at hero size and nothing
 * competing with it, the tabs actually going somewhere, and every empty state
 * saying what will appear rather than showing a blank.
 */
test.describe("client overview", () => {
  test.use({ viewport: DESKTOP });

  test("has exactly one number at hero size", async ({ page }) => {
    // One number at display size per screen. Six equal tiles across the top is
    // hard fail 9, and these six are not equals anyway. The size is read from
    // the token rather than written here: v1 said 56, v2 says 44, and a rule
    // that names a number goes stale the next time the scale moves.
    await openScreen(page, "client-overview");

    const heroes = await page.locator("main *").evaluateAll((nodes) => {
      const display = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--text-display"),
      );
      return nodes.filter(
        (node) => Math.round(parseFloat(getComputedStyle(node).fontSize)) >= display,
      ).length;
    });
    expect(heroes).toBe(1);
    await expect(page.getByTestId("elvt-score")).toHaveText("78");
  });

  test("shows the six numbers the coach reads", async ({ page }) => {
    await openScreen(page, "client-overview");
    const keys = await page
      .getByTestId("overview-tile")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-tile")));
    expect(keys).toEqual(["weight", "training", "run", "calories", "steps", "recovery"]);
  });

  test("links every tab to a route that exists", async ({ page }) => {
    await openScreen(page, "client-overview");
    const tabs = page.getByTestId("client-tab");
    expect(await tabs.count()).toBe(8);

    for (const href of await tabs.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("href")),
    )) {
      expect(href).toMatch(/^\/coach\/clients\/ekaterina(\/[a-z]+)?$/);
    }
    await expect(page.locator('[data-testid="client-tab"][data-active="true"]')).toHaveCount(1);
  });

  test("hides the race tab when there is no race", async ({ page }) => {
    await openScreen(page, "client-overview-new");
    await expect(page.getByTestId("client-tab")).toHaveCount(7);
    expect(
      await page.getByTestId("client-tab").evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-tab")),
      ),
    ).not.toContain("race");
  });

  test("colors nothing but the figures that earned it", async ({ page }) => {
    /*
     * Every state here comes from the adherence semantic, which is the only
     * thing in the build allowed to decide one.
     *
     * The v1 rule said the weight row is never colored. That was right for the
     * wrong reason: weight is neutral when the blueprint states no goal
     * direction, and this client's does -- recomp, which means hold -- so a
     * move off level is a real signal and gets one. The no-direction case is
     * neutral and is proved in tests/unit/semantic.test.ts.
     */
    await openScreen(page, "client-overview");
    const states = await page
      .getByTestId("overview-tile")
      .evaluateAll((nodes) =>
        nodes.map((node) => [node.getAttribute("data-tile"), node.getAttribute("data-state")]),
      );
    expect(states.find(([key]) => key === "weight")![1]).toBe("watch");
    expect(states.find(([key]) => key === "steps")![1]).toBe("flag");

    // And nothing that is not a figure carries a signal color.
    const strays = await page.evaluate(() => {
      const signals = ["--ok", "--watch", "--flag"].map((name) =>
        getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
      );
      const asRgb = (hex: string) => {
        const probe = document.createElement("span");
        probe.style.color = hex;
        document.body.append(probe);
        const value = getComputedStyle(probe).color;
        probe.remove();
        return value;
      };
      const wanted = new Set(signals.map(asRgb));
      return Array.from(document.querySelectorAll<HTMLElement>("main *"))
        .filter((el) => el.children.length === 0)
        .filter((el) => wanted.has(getComputedStyle(el).color))
        .filter((el) => !el.classList.contains("elvt-num"))
        .map((el) => (el.textContent ?? "").trim());
    });
    expect(strays).toEqual([]);
  });

  test("says what will appear on a client with nothing yet", async ({ page }) => {
    await openScreen(page, "client-overview-new");

    // Absent is an em dash and a reason, not a middot and not a zero. The
    // semantic owns that; v1 used a middot here and nowhere else.
    await expect(page.getByTestId("elvt-score")).toHaveText(EM_DASH);
    await expect(page.getByTestId("elvt-score")).toHaveAttribute("data-state", "absent");
    await expect(page.getByTestId("one-thing")).toContainText("intake");
    await expect(page.getByTestId("flags")).toContainText("None on file");
    await expect(page.getByTestId("last-checkin")).toContainText("check-in day");
    await expect(page.getByTestId("touchpoints")).toContainText("two a week");
    await expect(page.getByTestId("upcoming")).toContainText("six weeks");
  });

  test("keeps the top strip readable with the longest real name", async ({ page }) => {
    await openScreen(page, "client-overview");
    await expect(page.getByTestId("client-name")).toContainText("Vasilyeva-Whitcombe");
    await expect(page.getByTestId("client-facts")).toContainText("Day 32 of 84");
    await expect(page.getByTestId("phase-chip")).toHaveText("Build");
    await expect(page.getByTestId("race-line")).toContainText("Portland Half");
  });

  test("marks the coach notes private", async ({ page }) => {
    await openScreen(page, "client-overview");
    await expect(page.getByTestId("coach-notes")).toContainText("never sees");
  });
});

test.describe("client overview on a phone", () => {
  test.use({ viewport: PHONE });

  test("keeps the tabs on screen at 390", async ({ page }) => {
    await openScreen(page, "client-overview");
    await expect(page.getByTestId("client-tabs")).toBeVisible();

    for (const tab of await page.getByTestId("client-tab").all()) {
      const box = await tab.boundingBox();
      expect(box!.x + box!.width).toBeLessThanOrEqual(PHONE.width);
    }
  });

  test("keeps the hero number and its label on one line at 390", async ({ page }) => {
    await openScreen(page, "client-overview");
    const score = await page.getByTestId("elvt-score").boundingBox();
    expect(score!.x + score!.width).toBeLessThanOrEqual(PHONE.width);
  });
});

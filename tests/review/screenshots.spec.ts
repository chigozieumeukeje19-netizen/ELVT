import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { SCREENS } from "@/lib/design/preview-screens";
import { THEMES, THEME_COOKIE, type Theme } from "@/lib/design/theme";

/**
 * The review capture. Every screen, both themes, both viewports, written to
 * review/ as files rather than attached to a report.
 *
 * This is not a test of anything and asserts nothing about the design: the
 * visual suite does that. This exists so the whole product can be looked at in
 * one sitting, which is a different job and needs the images on disk.
 */

const VIEWPORTS = [
  { label: "1440x900", width: 1440, height: 900 },
  { label: "390x844", width: 390, height: 844 },
] as const;

const ROOT = join(process.cwd(), "review");

async function shoot(page: Page, screen: string, theme: Theme, dir: string) {
  await page.context().addCookies([
    { name: THEME_COOKIE, value: theme, url: test.info().project.use.baseURL! },
  ]);

  await page.goto(`/dev/preview/${screen}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("screen-ready")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);

  // The theme that was asked for is the theme on the page. A capture that
  // silently fell back to dark would fill the light folder with dark images.
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);

  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${screen}.png`), await page.screenshot({ fullPage: true }));
}

for (const theme of THEMES) {
  for (const viewport of VIEWPORTS) {
    test.describe(`${theme} ${viewport.label}`, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      for (const screen of SCREENS) {
        test(screen, async ({ page }) => {
          await shoot(page, screen, theme, join(ROOT, `${theme}-${viewport.label}`));
        });
      }
    });
  }
}

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SCREENS } from "@/lib/design/preview-screens";

const ROOT = path.resolve(__dirname, "../..");

/**
 * The design preview routes render the real components against the seed
 * fixtures so density and color rules stay enforced as new screens land. They
 * are development instrumentation and must never be reachable in a deployed
 * environment.
 */
describe("design preview routes", () => {
  const page = readFileSync(
    path.join(ROOT, "src/app/dev/preview/[screen]/page.tsx"),
    "utf8",
  );

  it("return 404 unless the flag is explicitly set to 1", () => {
    expect(page).toContain('process.env.ENABLE_DESIGN_PREVIEW !== "1"');
    expect(page).toContain("notFound()");
  });

  it("never read the database", () => {
    // The gate is only half the protection. These routes must not be able to
    // reach client data even if the flag were somehow set in a deployed build.
    // Checked against imports and calls rather than the word, so a comment
    // explaining why they do not touch Supabase does not fail the test.
    const imports = [...page.matchAll(/^import[^;]+from\s+"([^"]+)";$/gm)].map(
      (m) => m[1],
    );

    for (const source of imports) {
      expect(source).not.toMatch(/supabase/i);
      expect(source).not.toBe("@/lib/auth");
    }

    expect(page).not.toMatch(/supabase(Server|Admin|Browser)\s*\(/);
    expect(page).not.toMatch(/currentProfile\s*\(/);
  });

  it("are not enabled anywhere in the Netlify config", () => {
    const netlify = readFileSync(path.join(ROOT, "netlify.toml"), "utf8");
    expect(netlify).not.toContain("ENABLE_DESIGN_PREVIEW");
  });

  it("are not enabled by any committed env file or workflow", () => {
    const tracked = execFileSync(
      "git",
      ["ls-files", "*.toml", "*.yml", "*.yaml", ".env*", "*.json"],
      { cwd: ROOT, encoding: "utf8" },
    )
      .split("\n")
      .filter(Boolean);

    const offenders = tracked.filter((file) => {
      // A file can be tracked and already deleted from the working tree.
      const full = path.join(ROOT, file);
      if (!existsSync(full)) return false;
      const body = readFileSync(full, "utf8");
      // playwright.config.ts is the one place that sets it, and it is not in
      // this glob set. Anything here setting it is a deploy surface.
      return /ENABLE_DESIGN_PREVIEW\s*[:=]/.test(body);
    });

    expect(offenders).toEqual([]);
  });

  it("every preview screen is rendered by the route", () => {
    /*
     * The list used to be written out three times -- the route, the visual
     * suite, the review capture -- and this held the copies in step. There is
     * one list now, in src/lib/design/preview-screens.ts, so what is worth
     * checking has changed: a name on the list with no case in the switch is a
     * route that 404s, and the switch is exhaustive so the compiler cannot
     * catch it on its own.
     */
    expect(SCREENS.length).toBeGreaterThan(0);

    const missing = SCREENS.filter((screen) => !page.includes(`case "${screen}":`));
    expect(missing).toEqual([]);
  });

  it("the visual suite and the review capture walk that same list", () => {
    // Neither may restate it. A second list is how a screen ends up rendered
    // and never looked at.
    for (const file of ["tests/e2e/visual.spec.ts", "tests/review/screenshots.spec.ts"]) {
      const body = readFileSync(path.join(ROOT, file), "utf8");
      expect(body, `${file} does not read the shared screen list`).toContain(
        'from "@/lib/design/preview-screens"',
      );
      expect(body, `${file} restates the screen list`).not.toMatch(
        /const SCREENS\s*=/,
      );
    }
  });
});

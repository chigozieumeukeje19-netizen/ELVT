import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

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

  it("every preview screen has a matching visual assertion", () => {
    // Condition from the review: a new screen gets a preview route and the
    // visual spec grows with it. This keeps the two in step.
    const screens = [...page.matchAll(/^\s+"([a-z0-9-]+)",$/gm)].map((m) => m[1]);
    expect(screens.length).toBeGreaterThan(0);

    const spec = readFileSync(path.join(ROOT, "tests/e2e/visual.spec.ts"), "utf8");
    const listed = [...spec.matchAll(/^\s+"([a-z0-9-]+)",$/gm)].map((m) => m[1]);

    for (const screen of screens) {
      expect(listed, `${screen} is not in the visual spec`).toContain(screen);
    }
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * SETUP.md, held to the repository.
 *
 * A setup document is the one document that is read by somebody who cannot yet
 * tell whether it is wrong. Every command it names has to exist, and every
 * error message it promises has to be one the code really prints, or it costs
 * exactly the round it was written to save.
 */

const SETUP = readFileSync("SETUP.md", "utf8");
const PACKAGE = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts: Record<string, string>;
};

describe("every command it names", () => {
  it("is a script that exists", () => {
    const named = [...SETUP.matchAll(/npm run ([a-z0-9:-]+)/g)].map((match) => match[1]);
    expect(named.length).toBeGreaterThan(10);

    const missing = [...new Set(named)].filter((script) => !(script in PACKAGE.scripts));
    expect(missing).toEqual([]);
  });

  it("covers the whole gate, in one place", () => {
    // The list somebody runs on a clean machine. A gate command missing from
    // here is a check nobody new will ever run.
    for (const script of [
      "typecheck",
      "test",
      "db:verify",
      "db:conformance",
      "db:api-rls",
      "test:integration",
      "loop:walk",
      "test:e2e",
    ]) {
      expect(SETUP, script).toContain(`npm run ${script}`);
    }
  });
});

describe("every failure it promises", () => {
  it("is a message the code really prints", () => {
    // The table of what-you-see to what-to-run. Each left hand column entry is
    // a substring of a real error, so a reworded error shows up here rather
    // than sending somebody hunting.
    // The left column is what a person sees, so it carries a concrete port or
    // path where the code has a variable. Matched on the fixed part of the
    // message, which is what survives a reworded error.
    const promised: { text: string; from: string }[] = [
      { text: "Something is already on", from: "scripts/lib/env.sh" },
      { text: "The end to end run cannot start", from: "tests/e2e/global-setup.ts" },
      { text: "Cannot reach Postgres", from: "scripts/lib/db.sh" },
      { text: "is missing values for", from: "scripts/lib/env.sh" },
      { text: "Host mismatch", from: "scripts/lib/env.sh" },
      { text: "No PostgREST, so the integration tests cannot run", from: "scripts/integration.sh" },
      { text: "not one auth test was collected", from: "tests/e2e/auth-coverage-reporter.ts" },
    ];

    for (const entry of promised) {
      expect(SETUP, `SETUP.md no longer mentions: ${entry.text}`).toContain(entry.text);
      expect(readFileSync(entry.from, "utf8"), entry.from).toContain(entry.text);
    }
  });
});

describe("the host rule", () => {
  it("says 127.0.0.1 and agrees with config.toml", () => {
    // A browser treats localhost and 127.0.0.1 as different origins, and this
    // is the document that tells somebody which to type.
    expect(SETUP).toContain("127.0.0.1:3000/login");

    const config = readFileSync("supabase/config.toml", "utf8");
    const siteUrl = config.match(/^site_url\s*=\s*"([^"]+)"/m)![1];
    expect(SETUP).toContain(siteUrl.replace(/^https?:\/\//, ""));
  });
});

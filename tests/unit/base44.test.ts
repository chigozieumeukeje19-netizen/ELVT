import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DIR = path.resolve(__dirname, "../../integrations/base44");

/**
 * The Base44 functions.
 *
 * Nothing here is connected to Base44 and nothing in this repository calls
 * them, so these check the two things that would otherwise only be found by
 * pasting them in and watching them fail: that the paths they forward exist in
 * the portal, and that the API key stays where it belongs.
 */

const FILES = readdirSync(DIR).filter((entry) => entry.endsWith(".ts"));

describe("the Base44 backend functions", () => {
  it("ships all four", () => {
    expect(FILES.sort()).toEqual([
      "elvtGet.ts", "elvtPost.ts", "elvtSession.ts", "elvtWebhook.ts",
    ]);
  });

  it.each(FILES)("%s has no imports, so there is nothing to install", (file) => {
    const source = readFileSync(path.join(DIR, file), "utf8");
    expect(source).not.toMatch(/^\s*import\s/m);
  });

  it("keeps the portal API key out of everything a browser can reach", () => {
    // It mints a token for any client on the roster. Only the function that
    // exchanges an identity for one holds it.
    for (const file of FILES) {
      const source = readFileSync(path.join(DIR, file), "utf8");
      if (file === "elvtSession.ts") {
        expect(source).toContain("ELVT_PORTAL_API_KEY");
        continue;
      }
      expect(source, `${file} reads the API key`).not.toContain("ELVT_PORTAL_API_KEY");
    }
  });

  it("forwards only paths the portal actually has", () => {
    // A path that does not exist is a 404 a client sees and nobody can explain.
    const api = path.resolve(__dirname, "../../src/app/api/v1");
    const routes = new Set<string>();

    const walk = (dir: string, prefix = "") => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) walk(path.join(dir, entry.name), `${prefix}/${entry.name}`);
        else if (entry.name === "route.ts") routes.add(prefix);
      }
    };
    walk(api);

    const patterns = [
      ...readFileSync(path.join(DIR, "elvtGet.ts"), "utf8").matchAll(/\/\^(\\\/[^$]*)\$\//g),
      ...readFileSync(path.join(DIR, "elvtPost.ts"), "utf8").matchAll(/\/\^(\\\/[^$]*)\$\//g),
    ].map((match) => match[1]);

    expect(patterns.length).toBeGreaterThan(15);

    for (const pattern of patterns) {
      // Turn the forwarder's regex back into the route shape Next uses, so the
      // two can be compared rather than eyeballed.
      const shape = pattern
        .replace(/\\\//g, "/")
        .replace(/\[0-9a-f-\]\{36\}/g, "[id]")
        .replace(/\\d\{4\}-\\d\{2\}-\\d\{2\}/g, "[date]")
        .replace(/\\d\+/g, "[n]");

      const alternatives = shape.match(/\(([^)]*)\)/)?.[1]?.split("|") ?? [null];

      for (const alternative of alternatives) {
        const candidate = alternative === null
          ? shape
          : shape.replace(/\([^)]*\)/, alternative);
        expect(routes, `${candidate} is forwarded but does not exist`).toContain(candidate);
      }
    }
  });

  it("refuses a path it does not recognise rather than passing it through", () => {
    // The path arrives from the browser. A function that forwards whatever it
    // is handed will eventually be handed /auth/exchange.
    for (const file of ["elvtGet.ts", "elvtPost.ts"]) {
      const source = readFileSync(path.join(DIR, file), "utf8");
      expect(source, file).toContain("ALLOWED");
      expect(source, file).toMatch(/not one this function forwards/);
    }
  });

  it("compares the webhook secret in constant time", () => {
    const source = readFileSync(path.join(DIR, "elvtWebhook.ts"), "utf8");
    expect(source).toContain("constant time");
    // A plain equality check can be probed a character at a time.
    expect(source).not.toMatch(/presented\s*===\s*expected/);
  });

  it("acknowledges an event type it does not know rather than erroring", () => {
    // A portal that has added an event type is not an error, and answering with
    // one makes it retry forever.
    const source = readFileSync(path.join(DIR, "elvtWebhook.ts"), "utf8");
    expect(source).toMatch(/received: true, acted: false/);
  });

  it("names every secret the README says to set", () => {
    const readme = readFileSync(path.join(DIR, "README.md"), "utf8");
    for (const secret of ["ELVT_PORTAL_URL", "ELVT_PORTAL_API_KEY", "ELVT_WEBHOOK_SECRET"]) {
      expect(readme, secret).toContain(secret);
    }

    // And nothing reads a secret the README does not mention.
    const used = new Set<string>();
    for (const file of FILES) {
      for (const match of readFileSync(path.join(DIR, file), "utf8").matchAll(
        /Deno\.env\.get\("([A-Z_]+)"\)/g,
      )) {
        used.add(match[1]);
      }
    }
    for (const secret of used) {
      expect(readme, `${secret} is read but not documented`).toContain(secret);
    }
  });
});

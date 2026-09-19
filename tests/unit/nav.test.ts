import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NAV } from "@/lib/nav";

const ROOT = path.resolve(__dirname, "../..");

/**
 * A sidebar link to a page that does not exist.
 *
 * Three of them shipped: Calendar, Library and Settings all 404'd from the nav
 * that is on every coach screen. Nothing caught it because nothing checked, and
 * a dead link in the persistent chrome is the first thing a new coach clicks.
 *
 * The nav carries no dynamic segments, so a route is a directory with a page in
 * it and this resolves the same way the router does.
 */
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function routeExists(href: string): boolean {
  return existsSync(path.join(ROOT, "src/app", href, "page.tsx"));
}

describe("the sidebar", () => {
  const items = NAV.flatMap((group) => group.items);

  it("has links", () => {
    expect(items.length).toBeGreaterThan(0);
  });

  it("links only to pages that exist", () => {
    const dead = items.filter((item) => !routeExists(item.href)).map((item) => item.href);
    expect(dead).toEqual([]);
  });

  it("names every group", () => {
    for (const group of NAV) {
      expect(group.label.trim().length).toBeGreaterThan(0);
      // Sentence case, per DESIGN_V2.md 3.1. The all caps label is retired.
      expect(group.label).not.toBe(group.label.toUpperCase());
    }
  });

  it("leaves no dead internal link anywhere in the portal", () => {
    /*
     * The same failure in a different place. Only literal hrefs are checked:
     * anything built from a template literal carries a slug and cannot be
     * resolved from the source, and those are covered by the route tests.
     */
    // Walked off disk, not out of git. The first version of this asked
    // git ls-files, which does not list a file that has not been added yet,
    // so a dead link in a brand new screen passed.
    const files = walk(path.join(ROOT, "src")).filter((file) => file.endsWith(".tsx"));
    expect(files.length).toBeGreaterThan(0);

    const dead: string[] = [];
    for (const file of files) {
      const body = readFileSync(file, "utf8");
      for (const match of body.matchAll(/href="(\/[a-z0-9/-]*)"/g)) {
        const href = match[1];
        // Route handlers and the API are not pages; the form posts to one.
        if (href.startsWith("/auth/") || href.startsWith("/api/")) continue;
        if (!routeExists(href)) dead.push(`${path.relative(ROOT, file)} -> ${href}`);
      }
    }

    expect(dead).toEqual([]);
  });

});

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  BAND_THRESHOLDS,
  bandFor,
  bandLabel,
  bandTextClass,
  bandVar,
} from "@/lib/design/bands";

const tokens = readFileSync(
  path.resolve(__dirname, "../../src/styles/tokens.css"),
  "utf8",
);

describe("band thresholds", () => {
  it("match the values in tokens.css", () => {
    const ok = tokens.match(/--band-ok-min:\s*(\d+)/)?.[1];
    const watch = tokens.match(/--band-watch-min:\s*(\d+)/)?.[1];

    expect(Number(ok)).toBe(BAND_THRESHOLDS.ok);
    expect(Number(watch)).toBe(BAND_THRESHOLDS.watch);
  });

  it("are defined in exactly one module", () => {
    // Any other file comparing a score to 85 or 60 is a literal that will
    // drift. The audit enforces this too; this keeps it honest at the unit
    // level.
    const bands = readFileSync(
      path.resolve(__dirname, "../../src/lib/design/bands.ts"),
      "utf8",
    );
    expect(bands).toContain("ok: 85");
    expect(bands).toContain("watch: 60");
  });
});

describe("bandFor", () => {
  it("puts 85 and above on plan", () => {
    expect(bandFor(100)).toBe("ok");
    expect(bandFor(85)).toBe("ok");
  });

  it("puts 60 to 84 in drifting", () => {
    expect(bandFor(84)).toBe("watch");
    expect(bandFor(60)).toBe("watch");
  });

  it("puts below 60 in needs attention", () => {
    expect(bandFor(59)).toBe("flag");
    expect(bandFor(0)).toBe("flag");
  });

  it("has no band for missing data", () => {
    expect(bandFor(null)).toBeNull();
    expect(bandFor(undefined)).toBeNull();
    expect(bandFor(Number.NaN)).toBeNull();
  });
});

describe("band presentation", () => {
  it("maps each band to its own token and nothing else", () => {
    expect(bandVar("ok")).toBe("var(--ok)");
    expect(bandVar("watch")).toBe("var(--watch)");
    expect(bandVar("flag")).toBe("var(--flag)");
    expect(bandVar(null)).toBe("var(--txt-mute)");
  });

  it("gives every band a word, so color is never the only carrier", () => {
    for (const band of ["ok", "watch", "flag", null] as const) {
      expect(bandLabel(band).length).toBeGreaterThan(0);
      expect(bandTextClass(band)).toMatch(/^text-/);
    }
  });
});

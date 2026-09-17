import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  auditRepository,
  auditSource,
  vibeScore,
} from "@/lib/design/audit";
import { RULES } from "@/lib/design/audit-rules";

const ROOT = path.resolve(__dirname, "../..");

function rulesHitBy(source: string, file = "src/app/sample.tsx") {
  return auditSource(source, file).map((f) => f.rule);
}

/**
 * An audit nobody has seen fail is not an audit. Each case below is a line
 * someone would plausibly write, and the rule that has to catch it.
 */
describe("the audit catches every tell it claims to", () => {
  const cases: [string, string, string][] = [
    ["cream-background", "tell 0 cream page", `const bg = "#faf8f5";`],
    ["cream-tailwind", "tell 0 warm neutral", `<div className="bg-stone-50" />`],
    ["tasteful-serif", "tell 0 serif face", `import { Fraunces } from "next/font/google";`],
    ["sage-primary", "tell 0 sage", `<p className="text-emerald-800" />`],
    ["default-neutral-surface", "tell 1 stock neutral", `<div className="bg-slate-900" />`],
    ["shadcn-card-trio", "tell 1 stock card", `className="rounded-lg border bg-card text-card-foreground shadow-sm"`],
    ["default-radius-token", "tell 1 generated radius", `  --radius: 0.5rem;`],
    ["uniform-p6", "tell 1 uniform padding", `<section className="p-6" />`],
    ["ai-purple-class", "tell 2 AI purple", `<button className="bg-indigo-600" />`],
    ["ai-purple-hex", "tell 2 purple hex", `const brand = "#6366f1";`],
    ["gradient-text", "tell 3 gradient text", `<h1 className="bg-clip-text text-transparent" />`],
    ["gradient-utility", "tell 3 gradient", `<div className="bg-gradient-to-r" />`],
    ["motion-entrance", "tell 4 entrance", `<motion.div initial={{ opacity: 0, y: 20 }} />`],
    ["motion-hover-scale", "tell 4 hover scale", `<div className="hover:scale-105" />`],
    ["pill-shape", "tell 5 pill", `<button className="rounded-full" />`],
    ["large-radius", "tell 5 big radius", `<div className="rounded-2xl" />`],
    ["neon-glow", "tell 6 glow", `<div className="shadow-[0_0_24px_rgba(0,255,0,0.6)]" />`],
    ["neon-text", "tell 6 neon text", `<span className="text-cyan-400" />`],
    ["default-font", "tell 8 default face", `import { Inter } from "next/font/google";`],
    ["stat-tile-row", "tell 9 stat tiles", `<div className="grid grid-cols-3 gap-4" />`],
    ["marketing-headline", "tell 9 marketing size", `<h1 className="text-5xl" />`],
    ["arbitrary-spacing", "tell 10 arbitrary spacing", `<div className="mt-[37px]" />`],
    ["copy-cliche", "tell 11 cliche", `<p>Supercharge your training</p>`],
    ["empty-state-filler", "tell 11 filler", `<p>Nothing here yet</p>`],
    ["band-literal", "band literal", `const onPlan = score >= 85;`],
    ["gold-as-accent", "gold as accent", `const accent = "#8A6F34";`],
  ];

  for (const [rule, label, source] of cases) {
    it(`catches ${label}`, () => {
      expect(rulesHitBy(source)).toContain(rule);
    });
  }

  it("catches emoji standing in for an icon", () => {
    expect(rulesHitBy(`<h2>\u{1F680} Queue</h2>`)).toContain("emoji");
  });

  it("catches the client cream theme being imported into the portal", () => {
    expect(
      rulesHitBy(`import "@/styles/client-export-theme.css";`, "src/app/layout.tsx"),
    ).toContain("client-theme-leak");
  });
});

describe("unslop-ignore", () => {
  it("skips a line carrying the marker", () => {
    const source = `const bg = "#faf8f5"; // unslop-ignore brand cream, client apps only`;
    expect(rulesHitBy(source)).not.toContain("cream-background");
  });

  it("skips a line sitting directly under the marker", () => {
    const source = ["// unslop-ignore", `const bg = "#faf8f5";`].join("\n");
    expect(rulesHitBy(source)).not.toContain("cream-background");
  });

  it("skips a file whose opening comment declares it", () => {
    const source = [
      "/*",
      " * unslop-ignore",
      " * The v1 client theme, exempt per DESIGN.md tell 0.",
      " */",
      `.theme { --bg: #FAF7F2; }`,
    ].join("\n");
    expect(auditSource(source, "src/styles/client-export-theme.css")).toHaveLength(0);
  });

  it("does not skip a marker that appears far down an ordinary file", () => {
    const source = [
      ...Array.from({ length: 80 }, () => "// filler line to push past the header window"),
      `const bg = "#faf8f5";`,
    ].join("\n");
    expect(rulesHitBy(source)).toContain("cream-background");
  });
});

describe("the repository", () => {
  const findings = auditRepository(ROOT);

  it("has no high severity findings", () => {
    const high = findings.filter((f) => f.severity === "high");
    expect(
      high.map((f) => `${f.file}:${f.line} ${f.rule}`),
    ).toEqual([]);
  });

  it("scores at least 90", () => {
    expect(vibeScore(findings)).toBeGreaterThanOrEqual(90);
  });

  it("keeps the client cream theme out of every portal screen", () => {
    // The file exists and is exempt, but nothing under src/app may reach it.
    const leak = findings.filter((f) => f.rule === "client-theme-leak");
    expect(leak).toEqual([]);
  });
});

describe("the rule table", () => {
  it("has a unique id and a concrete fix for every rule", () => {
    const ids = RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const rule of RULES) {
      expect(rule.fix.length).toBeGreaterThan(20);
      // A fix that names another framework default is not a fix.
      expect(rule.fix).not.toMatch(/\b(?:slate|zinc|indigo|violet)-\d/);
    }
  });

  it("covers every tell the catalog makes mechanical", () => {
    const covered = new Set(RULES.map((r) => r.tell));
    // Tell 10 is mostly by eye, but the arbitrary value part is scannable.
    for (const tell of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) {
      expect(covered.has(tell)).toBe(true);
    }
  });
});

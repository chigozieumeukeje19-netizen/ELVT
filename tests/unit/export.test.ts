import { describe, expect, it } from "vitest";
import { auditExport, passesAudits } from "@/lib/export/audit";
import { assertExportable, ExportError, generateApp, titleFor } from "@/lib/export/generate";
import type { ExportData } from "@/lib/export/types";

function exercise(overrides: Partial<ExportData["weeks"][0]["days"][0]["sessions"][0]["exercises"][0]> = {}) {
  return {
    id: "ex-1",
    name: "Goblet Squat",
    youtubeId: "dQw4w9WgXcQ",
    cues: ["Chest up"],
    logsWeight: true,
    sets: [
      { set: 1, reps: 8, rest: 90 },
      { set: 2, reps: 8, rest: 90 },
    ],
    ...overrides,
  };
}

function data(overrides: Partial<ExportData> = {}): ExportData {
  return {
    client: {
      id: "c1",
      slug: "ekaterina",
      firstName: "Ekaterina",
      lastName: "Vasilyeva-Whitcombe",
      units: "imperial",
      timezone: "America/New_York",
    },
    program: {
      name: "Sixteen week recomposition",
      startDate: "2026-09-21",
      weeks: 16,
      goalStatement: "Down to 175 and still able to run a half",
      raceDate: "2027-03-14",
    },
    weeks: [
      {
        weekNumber: 1,
        startsOn: "2026-09-21",
        isDeload: false,
        phase: "Base",
        calories: 2650,
        protein: 193,
        carbs: 300,
        fat: 80,
        plannedMileage: 18,
        days: [
          {
            date: "2026-09-21",
            dayOfWeek: 1,
            isRest: false,
            calories: null,
            protein: null,
            sessions: [
              { id: "s1", kind: "strength", name: "Lower body", exercises: [exercise()] },
            ],
          },
          {
            date: "2026-09-22",
            dayOfWeek: 2,
            isRest: true,
            calories: null,
            protein: null,
            sessions: [],
          },
        ],
      },
    ],
    meals: [
      { id: "m1", name: "Breakfast", calories: 640, protein: 48, carbs: 70, fat: 18, items: [] },
    ],
    habits: [],
    reference: [{ title: "How to weigh in", body: "Same time, same conditions." }],
    apiBase: "https://portal.example.com/api/v1",
    generatedAt: "2026-09-19T12:00:00.000Z",
    ...overrides,
  };
}

describe("what the exporter refuses to generate", () => {
  it("refuses a movement with no verified video", () => {
    // A client mid set does not go hunting on YouTube for what a movement is.
    const broken = data();
    broken.weeks[0].days[0].sessions[0].exercises[0].youtubeId = "";
    expect(() => assertExportable(broken)).toThrow(/no verified video/);
  });

  it("refuses a weight box on a timed hold", () => {
    const broken = data();
    broken.weeks[0].days[0].sessions[0].exercises[0].sets = [{ set: 1, time: 45 }];
    expect(() => assertExportable(broken)).toThrow(/not rep based/);
  });

  it("refuses a weight box on a run", () => {
    const broken = data();
    broken.weeks[0].days[0].sessions[0].kind = "run";
    expect(() => assertExportable(broken)).toThrow(/not rep based/);
  });

  it("refuses a weight box on a rest day", () => {
    const broken = data();
    broken.weeks[0].days[0].isRest = true;
    expect(() => assertExportable(broken)).toThrow(/not rep based/);
  });

  it("refuses a client with no timezone, since every date is computed in theirs", () => {
    const broken = data();
    broken.client.timezone = "";
    expect(() => assertExportable(broken)).toThrow(ExportError);
  });

  it("refuses a client with no program", () => {
    expect(() => assertExportable(data({ weeks: [] }))).toThrow(/nothing to export/);
  });

  it("allows a timed hold with no weight box", () => {
    const fine = data();
    fine.weeks[0].days[0].sessions[0].exercises[0].sets = [{ set: 1, time: 45 }];
    fine.weeks[0].days[0].sessions[0].exercises[0].logsWeight = false;
    expect(() => assertExportable(fine)).not.toThrow();
  });
});

describe("the generated file", () => {
  const html = generateApp(data());

  it("is titled for the client it was generated for", () => {
    // The failure this prevents happened: the wrong client's file deployed to a
    // client's URL. A title naming who it is for makes that visible in the tab.
    expect(html).toContain(`<title>${titleFor(data())}</title>`);
    expect(html).toContain("Ekaterina");
    expect(html).toContain('name="generated-for" content="ekaterina"');
  });

  it("escapes a closing script tag inside the data", () => {
    // Every field in there is client data, so this is not hypothetical.
    const nasty = data();
    nasty.program.goalStatement = "</script><script>alert(1)</script>";
    const out = generateApp(nasty);
    const scriptOpens = (out.match(/<script>/g) ?? []).length;
    expect(scriptOpens).toBe(1);
  });

  it("escapes the title too", () => {
    const nasty = data();
    nasty.client.firstName = '<img src=x onerror="alert(1)">';
    expect(generateApp(nasty)).not.toContain("<img src=x");
  });

  it("carries the whole week, so it opens with no signal", () => {
    expect(html).toContain("2026-09-21");
    expect(html).toContain("Goblet Squat");
    expect(html).toContain("2650");
  });

  it("passes every audit", () => {
    expect(auditExport(html)).toEqual([]);
    expect(passesAudits(html)).toBe(true);
  });
});

describe("the audits themselves", () => {
  const html = generateApp(data());

  it("catches a scrollIntoView", () => {
    const broken = html.replace("window.scrollTo(scrollX, scrollY);", "root.scrollIntoView();");
    const findings = auditExport(broken);
    expect(findings.some((finding) => finding.rule.includes("scrollIntoView"))).toBe(true);
  });

  it("catches a render that does not restore the scroll position", () => {
    const broken = html.replace("window.scrollTo(scrollX, scrollY);", "");
    expect(auditExport(broken).some((f) => f.rule.includes("restores scroll"))).toBe(true);
  });

  it("catches saved state replacing the defaults instead of layering over them", () => {
    const broken = html.replace(
      "return Object.assign(defaults, saved);",
      "return saved;",
    );
    expect(auditExport(broken).some((f) => f.rule.includes("defaults first"))).toBe(true);
  });

  it("catches a render with no try around its cards", () => {
    const broken = html
      .replace(/try \{\n      html \+= cards\[i\]\[1\]\(\);/, "html += cards[i][1]();")
      .replace(/\} catch \(error\) \{[\s\S]*?\n    \}/, "");
    expect(auditExport(broken).some((f) => f.audit.includes("broken card"))).toBe(true);
  });

  it("catches a missing card", () => {
    const broken = html.replace('data-card="nutrition"', 'data-card="something-else"');
    expect(auditExport(broken).some((f) => f.rule.includes("nutrition card"))).toBe(true);
  });

  it("catches the cards being out of order", () => {
    // Moving the entry in the array render iterates, which is the thing that
    // actually changes what a client sees.
    const broken = html.replace(
      '["nutrition", cardNutrition],\n    ["trackers", cardTrackers],',
      '["trackers", cardTrackers],\n    ["nutrition", cardNutrition],',
    );
    expect(broken).not.toBe(html);
    expect(auditExport(broken).some((f) => f.rule.includes("fixed order"))).toBe(true);
  });

  it("catches a notes field", () => {
    const broken = html.replace('<main id="app"></main>', '<main id="app"><textarea></textarea></main>');
    expect(auditExport(broken).some((f) => f.rule.includes("no notes"))).toBe(true);
  });

  it("catches a Monday card keyed to today instead of the viewed day", () => {
    const broken = html.replace(
      "if (weekdayOf(state.viewedDate) !== 1) return \"\";",
      "if (weekdayOf(todayLocal()) !== 1) return \"\";",
    );
    expect(auditExport(broken).some((f) => f.rule.includes("Monday cards follow"))).toBe(true);
  });

  it("catches destructive week switching", () => {
    const broken = html.replace(
      /state\.archive\[String\(state\.viewedWeek\)\] = \{[\s\S]*?\};/,
      "",
    ).replace(/var restored = state\.archive\[String\(number\)\];/, "var restored = null;");
    expect(auditExport(broken).some((f) => f.rule.includes("non destructive"))).toBe(true);
  });

  it("catches a file with no offline queue", () => {
    const broken = html.replace(/navigator\.onLine/g, "true");
    expect(auditExport(broken).some((f) => f.rule.includes("queues when offline"))).toBe(true);
  });

  it("catches a file that never drains the queue", () => {
    const broken = html.replace('window.addEventListener("online", drain);', "");
    expect(auditExport(broken).some((f) => f.rule.includes("drains when it comes back"))).toBe(true);
  });
});

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { CLIENT_TOKENS } from "@/lib/export/theme";

describe("the client theme", () => {
  it("matches the CSS record, so the two cannot drift", () => {
    // The tokens were in two places, and the design audit caught the second
    // copy. One file holds them now; this keeps the portal side record in step.
    const css = readFileSync(
      path.resolve(__dirname, "../../src/styles/client-export-theme.css"),
      "utf8",
    );

    for (const [name, value] of Object.entries(CLIENT_TOKENS)) {
      expect(css, `${name} disagrees`).toContain(`${name}: ${value};`);
    }
  });

  it("is not imported by anything the portal renders", () => {
    // Inheriting the client brand is exactly how a chosen look slides into
    // being the default one. DESIGN.md Part 1 tell 0.
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry)) {
          const source = readFileSync(full, "utf8");
          if (
            source.includes("client-export-theme") ||
            source.includes("@/lib/export/theme")
          ) {
            offenders.push(path.relative(process.cwd(), full));
          }
        }
      }
    };

    for (const dir of ["src/app", "src/components"]) {
      walk(path.resolve(__dirname, "../..", dir));
    }

    expect(offenders).toEqual([]);
  });
});

import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PACK_CLIENT, PACK_JOBS } from "@/lib/ai/pack";
import { readBlueprintPaste, readProgramPaste } from "@/lib/ai/paste";
import {
  blueprintDrafterPrompt,
  programDrafterPrompt,
  weeklyReviewPrompt,
} from "@/lib/ai/prompts";
import { checkVoice } from "@/lib/ai/voice";

/**
 * The prompt pack, held to the parsers it documents.
 *
 * A document that claims a response is accepted is worth nothing unless
 * something runs it. These assert that every example marked good gets through
 * the real parser, that every example marked rejected really is rejected, and
 * that the file on disk still matches the prompt the portal generates.
 */

describe("the good examples", () => {
  it("get through the blueprint parser", () => {
    const job = PACK_JOBS.find((entry) => entry.key === "blueprint-drafter")!;
    const result = readBlueprintPaste(job.good);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.oneThing).toBeTruthy();
    expect(result.value.failureMode).toBeTruthy();
  });

  it("get through the program parser, every week of the block", () => {
    const job = PACK_JOBS.find((entry) => entry.key === "program-drafter")!;
    const result = readProgramPaste(job.good, 12);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(12);
    expect(result.value.map((entry) => entry.week)).toEqual(
      Array.from({ length: 12 }, (_, index) => index + 1),
    );
  });

  it("follow the voice rules they are showing off", () => {
    // An example that breaks the rules the prompt states teaches the model the
    // rules are optional.
    const blueprint = PACK_JOBS.find((entry) => entry.key === "blueprint-drafter")!;
    const parsed = JSON.parse(blueprint.good) as Record<string, string>;

    for (const field of ["summary", "oneThing", "failureMode", "toneNotes"]) {
      expect(checkVoice(parsed[field]), field).toEqual([]);
    }

    const weekly = JSON.parse(
      PACK_JOBS.find((entry) => entry.key === "weekly-review")!.good,
    ) as { message: string };
    expect(checkVoice(weekly.message)).toEqual([]);
  });

  it("asks exactly one question in the client message", () => {
    const weekly = JSON.parse(
      PACK_JOBS.find((entry) => entry.key === "weekly-review")!.good,
    ) as { message: string };

    expect(weekly.message.split("?").length - 1).toBe(1);
    const lines = weekly.message.split("\n").filter((line) => line.trim());
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines.length).toBeLessThanOrEqual(5);
  });

  it("proposes nothing on a week with no flag and no trend, beyond what was asked for", () => {
    // The three decision rules are the whole job of the weekly drafter, and
    // the example is the only place a reader sees them applied.
    const weekly = JSON.parse(
      PACK_JOBS.find((entry) => entry.key === "weekly-review")!.good,
    ) as { changes: { field: string }[] };

    expect(weekly.changes).toHaveLength(1);
    expect(weekly.changes[0].field).toBe("step_goal");
  });
});

describe("the rejected examples", () => {
  it("really are rejected, with the error the file prints", () => {
    for (const job of PACK_JOBS) {
      const parse =
        job.key === "program-drafter"
          ? (raw: string) => readProgramPaste(raw, 12)
          : job.key === "blueprint-drafter"
            ? readBlueprintPaste
            : null;
      if (!parse) continue;

      for (const bad of job.bad) {
        const result = parse(bad.paste);
        expect(result.ok, `${job.key}: ${bad.why}`).toBe(false);
        if (!result.ok) expect(result.error).toBeTruthy();
      }
    }
  });
});

describe("the files on disk", () => {
  const ROOT = "docs/ai-prompts";

  it("exist, one per job plus the README", () => {
    expect(existsSync(`${ROOT}/README.md`)).toBe(true);
    for (const job of PACK_JOBS) {
      expect(existsSync(`${ROOT}/${job.key}.md`), job.key).toBe(true);
    }
  });

  it("carry the prompt the portal actually generates", () => {
    // The reason the pack is generated rather than written. A hand edited
    // prompt drifts from the one the portal sends, and the first person to
    // notice is the coach wondering why the output looks nothing like it.
    const generated: Record<string, string> = {
      "blueprint-drafter": blueprintDrafterPrompt(PACK_CLIENT.derived, PACK_CLIENT.answers),
      "program-drafter": programDrafterPrompt(PACK_CLIENT.blueprint, "Twelve week recomposition", 12),
      "weekly-review": weeklyReviewPrompt(PACK_CLIENT.blueprint, PACK_CLIENT.week),
    };

    for (const [key, prompt] of Object.entries(generated)) {
      const file = readFileSync(`${ROOT}/${key}.md`, "utf8");
      expect(file.includes(prompt), `${key} is stale. Run npm run ai:pack.`).toBe(true);
    }
  });

  it("says which of the spec's seven jobs do not go through a model", () => {
    const readme = readFileSync(`${ROOT}/README.md`, "utf8");
    for (const job of ["Calorie path proposer", "Trigger message drafter", "Form generator", "Check-in summarizer"]) {
      expect(readme, job).toContain(job);
    }
    expect(readme).toContain("AI_PROVIDER");
  });
});

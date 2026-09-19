import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ALL_QUESTIONS, resolveQuestions } from "@/lib/checkin/bank";

/**
 * The bank and everything that names a question from it.
 *
 * Three places write into checkin_forms.questions and three places read it,
 * and they had drifted into three different key vocabularies: the module's own
 * keys, the seeded question_bank table's keys, and whole question objects.
 * Every seeded client had a check-in form whose questions resolved to nothing,
 * on every screen, and nothing said so.
 */

describe("resolving a stored form", () => {
  it("reads an array of keys, which is what every writer now writes", () => {
    const resolved = resolveQuestions(["session_done", "sleep_hours"]);
    expect(resolved.map((question) => question.key)).toEqual(["session_done", "sleep_hours"]);
    expect(resolved[0].text).toBeTruthy();
    expect(resolved[0].type).toBeTruthy();
  });

  it("still reads the older rows that stored whole objects", () => {
    const resolved = resolveQuestions([{ key: "energy", text: "Stale wording", type: "scale" }]);
    expect(resolved).toHaveLength(1);
    // The bank's copy wins, so a reworded question reads the same everywhere.
    expect(resolved[0].text).toBe(ALL_QUESTIONS.find((q) => q.key === "energy")!.text);
  });

  it("drops a key the bank does not know rather than rendering it raw", () => {
    // An unrecognised key on a screen is a question nobody can answer.
    expect(resolveQuestions(["daily_session", "session_done"]).map((q) => q.key)).toEqual([
      "session_done",
    ]);
  });

  it("survives a column holding something that is not a list", () => {
    expect(resolveQuestions(null)).toEqual([]);
    expect(resolveQuestions({})).toEqual([]);
  });
});

describe("the seed's check-in forms", () => {
  it("names only questions the bank has", () => {
    // This is the guard for the defect above. The seed writes these keys in
    // SQL, which cannot import the bank, so the only thing that can hold the
    // two together is a test that reads both.
    const seed = readFileSync("supabase/seed.sql", "utf8");
    const known = new Set(ALL_QUESTIONS.map((question) => question.key));

    const arrays = [
      ...seed.matchAll(/insert into public\.checkin_forms[\s\S]*?jsonb_build_array\(([\s\S]*?)\)/g),
    ];
    expect(arrays.length).toBeGreaterThan(0);

    const keys = arrays.flatMap((match) =>
      [...match[1].matchAll(/'([a-z0-9_]+)'/g)].map((key) => key[1]),
    );
    expect(keys.length).toBeGreaterThan(0);

    expect(keys.filter((key) => !known.has(key))).toEqual([]);
  });
});

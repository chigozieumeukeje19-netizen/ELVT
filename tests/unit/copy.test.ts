import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";

const root = path.resolve(__dirname, "../..");

function sourceFiles(): string[] {
  return execFileSync("bash", ["-lc", `find ${root}/src -name '*.tsx' -o -name '*.ts'`], {
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean);
}

/**
 * Two standing rules from the spec, enforced rather than remembered:
 * no dashes anywhere in copy a client or coach reads, and US English only.
 */
describe("UI copy", () => {
  const files = sourceFiles();

  it("uses no em dash, en dash or double hyphen", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const body = readFileSync(file, "utf8");
      body.split("\n").forEach((line, i) => {
        // A double hyphen between two word characters is a dash in prose.
        // CSS custom properties such as --font-body are not, so the left
        // side has to be a word character for this to fire.
        if (/[–—]/.test(line) || /\w--\w/.test(line)) {
          offenders.push(`${path.relative(root, file)}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it("uses US spellings", () => {
    // The British forms most likely to slip into coaching copy.
    const british = [
      "colour",
      "behaviour",
      "favourite",
      "programme",
      "centre",
      "organise",
      "recognise",
      "personalised",
      "prioritise",
    ];
    const offenders: string[] = [];
    for (const file of files) {
      const body = readFileSync(file, "utf8").toLowerCase();
      for (const word of british) {
        if (body.includes(word)) {
          offenders.push(`${path.relative(root, file)}: ${word}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

/**
 * The DESIGN.md audit.
 *
 * Scans .ts, .tsx, .css and .html against every code signature in Part 1,
 * reports file, line, tell, severity and the concrete fix, prints a vibe score
 * and the top three fixes, and exits with the high severity count so CI gates
 * on it.
 *
 *   npm run design:audit
 *   npm run design:audit -- --json
 *
 * A line carrying an `unslop-ignore` comment is skipped, and so is a file whose
 * opening comment block carries one. Use it only for real decisions recorded in
 * DESIGN.md Part 2, so the audit stays trustworthy.
 */

import path from "node:path";
import { auditRepository, vibeScore, type Finding } from "../src/lib/design/audit";

const ROOT = path.resolve(__dirname, "..");

function main() {
  const findings = auditRepository(ROOT);
  const high = findings.filter((f) => f.severity === "high");
  const medium = findings.filter((f) => f.severity === "medium");

  if (process.argv.includes("--json")) {
    console.log(
      JSON.stringify(
        {
          findings,
          high: high.length,
          medium: medium.length,
          score: vibeScore(findings),
        },
        null,
        2,
      ),
    );
    process.exit(high.length);
  }

  console.log("DESIGN.md audit");
  console.log("===============");
  console.log("");

  if (findings.length === 0) {
    console.log("No findings. Vibe score 100.");
    process.exit(0);
  }

  for (const group of [high, medium] as Finding[][]) {
    if (group.length === 0) continue;
    console.log(`${group[0].severity.toUpperCase()} (${group.length})`);
    console.log("");
    for (const f of group) {
      console.log(`  ${f.file}:${f.line}`);
      console.log(`    tell ${f.tell}  ${f.title}  [${f.rule}]`);
      console.log(`    found: ${f.excerpt}`);
      console.log(`    fix:   ${f.fix}`);
      console.log("");
    }
  }

  // Top three by how many findings each rule accounts for: fixing the rule at
  // the top clears the most ground.
  const byRule = new Map<string, { count: number; fix: string; title: string }>();
  for (const f of findings) {
    const entry = byRule.get(f.rule) ?? { count: 0, fix: f.fix, title: f.title };
    entry.count += 1;
    byRule.set(f.rule, entry);
  }

  console.log("TOP THREE FIXES");
  console.log("");
  [...byRule.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3)
    .forEach(([rule, entry], i) => {
      console.log(`  ${i + 1}. ${entry.title} (${entry.count}) [${rule}]`);
      console.log(`     ${entry.fix}`);
    });

  console.log("");
  console.log(`Vibe score: ${vibeScore(findings)}`);
  console.log(`High: ${high.length}   Medium: ${medium.length}`);

  process.exit(high.length);
}

main();

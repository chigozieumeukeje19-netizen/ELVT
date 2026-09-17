/**
 * The scanning engine behind scripts/design-audit.ts.
 *
 * Kept separate from the script so the rules can be exercised against known bad
 * input in a unit test. An audit nobody has seen fail is not an audit.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import {
  RULES,
  SCANNED_EXTENSIONS,
  SKIPPED_PATHS,
  type Severity,
} from "./audit-rules";

export type Finding = {
  file: string;
  line: number;
  rule: string;
  tell: number;
  title: string;
  severity: Severity;
  fix: string;
  excerpt: string;
};

/** A file whose opening comment block declares the exemption. */
export function fileIsExempt(body: string): boolean {
  return body.slice(0, 1200).includes("unslop-ignore");
}

/** A line carrying the marker, or sitting directly under one. */
export function lineIsExempt(lines: string[], index: number): boolean {
  if (lines[index].includes("unslop-ignore")) return true;
  return index > 0 && lines[index - 1].includes("unslop-ignore");
}

/** Runs the rule table over one file's contents. */
export function auditSource(
  body: string,
  relativePath: string,
): Finding[] {
  if (fileIsExempt(body)) return [];

  const ext = path.extname(relativePath);
  const lines = body.split("\n");
  const findings: Finding[] = [];

  for (const rule of RULES) {
    if (rule.extensions && !rule.extensions.includes(ext)) continue;
    if (rule.exempt?.some((p) => relativePath === p || relativePath.startsWith(p))) {
      continue;
    }

    lines.forEach((line, i) => {
      // A fresh regex per line: a stateful global would skip matches.
      const pattern = new RegExp(
        rule.pattern.source,
        rule.pattern.flags.replace("g", ""),
      );
      if (!pattern.test(line)) return;
      if (lineIsExempt(lines, i)) return;

      findings.push({
        file: relativePath,
        line: i + 1,
        rule: rule.id,
        tell: rule.tell,
        title: rule.title,
        severity: rule.severity,
        fix: rule.fix,
        excerpt: line.trim().slice(0, 120),
      });
    });
  }

  return findings;
}

function walk(root: string, dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".") && entry !== ".github") continue;
    const full = path.join(dir, entry);
    const rel = path.relative(root, full);
    if (
      SKIPPED_PATHS.some(
        (skip) => `${rel}/`.startsWith(skip) || rel === skip.replace(/\/$/, ""),
      )
    ) {
      continue;
    }
    if (statSync(full).isDirectory()) {
      walk(root, full, out);
    } else if (SCANNED_EXTENSIONS.includes(path.extname(entry))) {
      out.push(full);
    }
  }
  return out;
}

export function auditRepository(root: string): Finding[] {
  const findings = walk(root, root).flatMap((file) =>
    auditSource(readFileSync(file, "utf8"), path.relative(root, file)),
  );

  return findings.sort(
    (a, b) =>
      (a.severity === b.severity ? 0 : a.severity === "high" ? -1 : 1) ||
      a.file.localeCompare(b.file) ||
      a.line - b.line,
  );
}

/**
 * 100 is a clean scan. A high severity finding is a tell someone would name out
 * loud, so it costs 8. A medium is drift that adds up, so it costs 2. The score
 * summarizes the list; it is not a thing to optimize on its own.
 */
export function vibeScore(findings: Finding[]): number {
  const high = findings.filter((f) => f.severity === "high").length;
  const medium = findings.length - high;
  return Math.max(0, 100 - high * 8 - medium * 2);
}

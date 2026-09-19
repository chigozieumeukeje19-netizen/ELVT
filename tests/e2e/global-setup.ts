import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Everything the run needs on disk, checked once before a single test starts.
 *
 * A missing setup file is not a test failure. It behaved like ten of them: the
 * client app fixture is gitignored, so on a fresh checkout every test in
 * client-app.spec.ts threw ENOENT out of readFileSync, the run hit its
 * maxFailures budget at ten, and 334 unrelated tests never ran. The report
 * said nothing about a fixture.
 *
 * Throwing here aborts the whole run before any test executes, so a setup
 * problem costs one line instead of the suite. Same shape as the port check in
 * the preflight: a run that cannot start says why, once.
 */

type Requirement = {
  file: string;
  what: string;
  fix: string;
};

const REQUIRED: Requirement[] = [
  {
    file: "tests/e2e/fixtures/client-app.html",
    what: "the generated client app, which every client-app test drives in a browser",
    // Generated rather than committed, on purpose: it is the real generator's
    // output, and a committed copy goes stale the moment the generator changes,
    // at which point the tests pass against an artifact nobody ships.
    fix: "npm run export:fixture",
  },
];

export default function globalSetup(): void {
  const root = path.resolve(__dirname, "../..");
  const missing = REQUIRED.filter((entry) => !existsSync(path.join(root, entry.file)));

  if (missing.length === 0) return;

  const lines = [
    "",
    "The end to end run cannot start. Missing:",
    "",
    ...missing.flatMap((entry) => [
      `  ${entry.file}`,
      `    ${entry.what}`,
      `    Generate it with: ${entry.fix}`,
      "",
    ]),
    "npm run test:e2e does this for you. This is what it looks like when",
    "playwright test is run on its own from a fresh checkout.",
    "",
  ];

  throw new Error(lines.join("\n"));
}

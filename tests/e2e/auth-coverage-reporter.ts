import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";

/**
 * Says out loud how many auth tests actually ran.
 *
 * These are the only tests that exercise a real sign in, and they skipped
 * silently for weeks inside a "75 passed, 8 skipped" line that reads like a
 * pass. A number at the end of the run makes that impossible to miss.
 *
 * Collection is checked first, before a single test runs. A run where none of
 * them were even collected printed its warning at the very bottom, after
 * everything, where it read as a note rather than as the reason the run was
 * worthless. That is the same silent green in a new shape: nothing signed
 * anyone in and the run still ended green. Now it says so at the top and the
 * run fails.
 */

const AUTH_FILES = ["auth.spec.ts", "auth-grant.spec.ts", "exchange.spec.ts"];

export default class AuthCoverageReporter implements Reporter {
  private ran = 0;
  private skipped = 0;
  private failed = 0;
  private collected = 0;
  private narrowed = false;

  onBegin(config: FullConfig, suite: Suite) {
    this.collected = suite
      .allTests()
      .filter((test) => AUTH_FILES.some((file) => test.location.file.endsWith(file)))
      .length;

    this.narrowed = wasNarrowed(config);

    if (this.collected > 0) return;

    if (this.narrowed) {
      // Somebody asked for a subset. Still said out loud, because a subset
      // that happens to exclude the only tests that sign anyone in should not
      // be mistaken for a full run, but it is not a failure.
      console.log("");
      console.log("AUTH COVERAGE: this run was narrowed and collected no auth tests.");
      console.log("Nothing here proves the login flow. A full run does.");
      console.log("");
      return;
    }

    const line = "\u2500".repeat(64);
    console.log("");
    console.log(line);
    console.log("AUTH COVERAGE: not one auth test was collected.");
    console.log("");
    console.log("Nothing in this run can sign anyone in, so whatever it reports");
    console.log("about the login flow is worth nothing. This is a failure, not a");
    console.log("note, and it is printed here rather than at the end so it is read.");
    console.log("");
    console.log("Usually one of:");
    console.log("  - the servers never started, so every spec errored at collection");
    console.log("  - a --grep or a testIgnore excluded them");
    console.log("  - the three auth spec files were renamed and this reporter was not");
    console.log(line);
    console.log("");
  }

  onTestEnd(test: TestCase, result: TestResult) {
    if (!AUTH_FILES.some((file) => test.location.file.endsWith(file))) return;
    if (result.retry > 0) return;

    if (result.status === "skipped") {
      this.skipped += 1;
      return;
    }

    this.ran += 1;
    if (result.status !== "passed") this.failed += 1;
  }

  async onEnd(_result: FullResult): Promise<{ status: FullResult["status"] } | void> {
    const total = this.ran + this.skipped;
    const line = "─".repeat(64);

    console.log("");
    console.log(line);

    if (total === 0 && this.narrowed) {
      console.log("AUTH COVERAGE: narrowed run, no auth tests in it.");
      console.log("The login flow is UNPROVED by this run, on purpose.");
    } else if (total === 0) {
      console.log("AUTH COVERAGE: no auth test ran. See the top of this run.");
      console.log("The login flow is UNPROVED.");
    } else if (this.skipped > 0) {
      console.log(
        `AUTH COVERAGE: ${this.ran} of ${total} auth tests ran, ${this.skipped} SKIPPED.`,
      );
      console.log(
        "The login flow is UNPROVED. Nothing in this run signed anyone in.",
      );
    } else if (this.failed > 0) {
      console.log(`AUTH COVERAGE: all ${total} auth tests ran, ${this.failed} failed.`);
      console.log("The login flow is BROKEN, which is at least now known.");
    } else {
      console.log(`AUTH COVERAGE: all ${total} auth tests ran and passed.`);
      console.log("Coach password sign in and client magic link are PROVED.");
    }

    console.log(line);
    console.log("");

    // A full run that collected no auth tests fails, whatever else passed.
    // The exit code is the only part of this a script reads.
    if (this.collected === 0 && !this.narrowed) return { status: "failed" };
  }
}

/**
 * Whether the caller asked for a subset.
 *
 * A narrowed run missing the auth tests is a choice; a full run missing them
 * is a broken run. Read from the resolved config where Playwright puts a
 * --grep, and from the command line for a file or directory argument, which
 * the config does not carry.
 */
function wasNarrowed(config: FullConfig): boolean {
  const grep = config.grep;
  const patterns = Array.isArray(grep) ? grep : [grep];
  if (patterns.some((pattern) => pattern && pattern.source !== ".*")) return true;

  const invert = config.grepInvert;
  if (invert && (Array.isArray(invert) ? invert.length > 0 : true)) return true;

  // `playwright test tests/e2e/visual.spec.ts` and friends. Anything that is
  // not a flag and looks like a path into the test directory.
  return process.argv.slice(2).some((arg) => !arg.startsWith("-") && /\.spec\.|tests[\\/]/.test(arg));
}

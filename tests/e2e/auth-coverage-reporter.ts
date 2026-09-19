import type {
  FullResult,
  Reporter,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";

/**
 * Says out loud how many auth tests actually ran.
 *
 * These are the only tests that exercise a real sign in, and they skipped
 * silently for weeks inside a "75 passed, 8 skipped" line that reads like a
 * pass. A number at the end of the run makes that impossible to miss.
 */

const AUTH_FILES = ["auth.spec.ts", "auth-grant.spec.ts", "exchange.spec.ts"];

export default class AuthCoverageReporter implements Reporter {
  private ran = 0;
  private skipped = 0;
  private failed = 0;

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

  onEnd(_result: FullResult) {
    const total = this.ran + this.skipped;
    const line = "─".repeat(64);

    console.log("");
    console.log(line);

    if (total === 0) {
      console.log("AUTH COVERAGE: no auth tests were collected at all.");
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
  }
}

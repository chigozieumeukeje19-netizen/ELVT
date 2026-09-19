import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

/**
 * Playwright does not read .env.local. Next does, for the server it starts, and
 * the preflight script sources it itself, so both of those worked while the
 * test process saw none of it.
 *
 * That is why the auth tests skipped: supabaseIsUp() reads
 * NEXT_PUBLIC_SUPABASE_URL from process.env, found undefined, and returned
 * false before it ever probed GoTrue.
 */
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

/**
 * ONE host, written once.
 *
 * localhost and 127.0.0.1 are different origins to a browser: a session cookie
 * set on one is not sent to the other. Every host in the project has to agree
 * or a magic link lands on the origin the session is not on. This is the value
 * supabase/config.toml's site_url must also use, and the preflight checks that
 * they match rather than trusting it.
 */
export const E2E_HOST = process.env.E2E_HOST ?? "127.0.0.1";
const PORT = Number(process.env.PORT ?? 3000);
const baseURL = process.env.E2E_BASE_URL ?? `http://${E2E_HOST}:${PORT}`;

/**
 * A second production server with ENABLE_DESIGN_PREVIEW deliberately unset, so
 * the preview gate is proved closed rather than assumed closed. This is the
 * shape of every deployed environment.
 */
const UNFLAGGED_PORT = Number(process.env.UNFLAGGED_PORT ?? 3101);
export const UNFLAGGED_URL = `http://${E2E_HOST}:${UNFLAGGED_PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",

  // A local page render is fast or broken. These are sized so a hang costs
  // seconds: 27 screens at the old 60 second ceiling was 22 minutes of a suite
  // telling nobody anything.
  timeout: 20_000,
  expect: { timeout: 5_000 },

  // Nothing here writes shared state, so there is no reason to run one at a
  // time. CI keeps a single worker because its runners are small.
  fullyParallel: true,
  workers: process.env.CI ? 1 : 4,

  // Fail the run early rather than grinding through every remaining test when
  // something systemic is wrong, such as a server that will not serve.
  maxFailures: process.env.CI ? 0 : 10,

  // The list reporter, plus one that says out loud how many auth tests ran.
  // A skipped suite buried in a count reads like a pass.
  reporter: [["list"], ["./tests/e2e/auth-coverage-reporter.ts"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    trace: "retain-on-failure",
    navigationTimeout: 10_000,
    actionTimeout: 10_000,
    // Some CI images ship a Chromium that does not match the version this
    // Playwright would download. Point at it rather than fetching another.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        {
          // Guarded so a missing build says what to do instead of failing as a
          // raw Next error inside a webServer timeout.
          command: `bash scripts/e2e-server.sh ${PORT}`,
          url: baseURL,
          reuseExistingServer: true,
          timeout: 120_000,
          env: {
            // The design preview routes render the real components against the
            // seed fixtures so the layout can be measured without a signed in
            // session. Off everywhere else.
            ENABLE_DESIGN_PREVIEW: "1",
          },
        },
        {
          // Same production build, no flag. Stands in for a deployed
          // environment so the gate is tested, not trusted.
          command: `bash scripts/e2e-server.sh ${UNFLAGGED_PORT}`,
          url: `${UNFLAGGED_URL}/login`,
          reuseExistingServer: true,
          timeout: 120_000,
        },
      ],
});

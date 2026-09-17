import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3000);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

/**
 * A second production server with ENABLE_DESIGN_PREVIEW deliberately unset, so
 * the preview gate is proved closed rather than assumed closed. This is the
 * shape of every deployed environment.
 */
const UNFLAGGED_PORT = Number(process.env.UNFLAGGED_PORT ?? 3101);
export const UNFLAGGED_URL = `http://127.0.0.1:${UNFLAGGED_PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    trace: "retain-on-failure",
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
          command: "npm run start",
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
          command: `npx next start -p ${UNFLAGGED_PORT}`,
          url: `${UNFLAGGED_URL}/login`,
          reuseExistingServer: true,
          timeout: 120_000,
        },
      ],
});

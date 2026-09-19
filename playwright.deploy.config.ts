import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

/**
 * The served half of the deploy dry run.
 *
 * One server, the production build, and deliberately no ENABLE_DESIGN_PREVIEW:
 * this is the shape of a deployed environment rather than of a test rig. The
 * server is Playwright's to start and stop, which is the point -- managing it
 * from the shell leaked one on every run.
 */
const PORT = Number(process.env.DRY_RUN_PORT ?? 3103);
const baseURL = `http://${process.env.E2E_HOST ?? "127.0.0.1"}:${PORT}`;

export default defineConfig({
  testDir: "./tests/deploy",
  timeout: 30_000,
  workers: 1,
  reporter: [["list"]],
  use: { ...devices["Desktop Chrome"], ...base.use, baseURL },
  webServer: {
    command: `bash scripts/e2e-server.sh ${PORT}`,
    url: `${baseURL}/login`,
    // Never reuse. The whole question is what THIS build serves.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

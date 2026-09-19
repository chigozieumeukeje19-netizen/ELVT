import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

/**
 * The review capture, on its own config.
 *
 * Same production build and the same preview flag as the visual suite, but one
 * server instead of two and no auth coverage reporter: nothing here proves
 * anything about auth and a banner saying so on every run would train people
 * to ignore it. Reuses the main config's browser resolution and base URL.
 */
const PORT = Number(process.env.REVIEW_PORT ?? 3102);
const baseURL = `http://${process.env.E2E_HOST ?? "127.0.0.1"}:${PORT}`;

export default defineConfig({
  testDir: "./tests/review",
  timeout: 30_000,
  fullyParallel: true,
  workers: 4,
  reporter: [["list"]],
  use: { ...devices["Desktop Chrome"], ...base.use, baseURL },
  webServer: {
    command: `bash scripts/e2e-server.sh ${PORT}`,
    url: `${baseURL}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { ENABLE_DESIGN_PREVIEW: "1" },
  },
});

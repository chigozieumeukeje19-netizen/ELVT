import { config as loadEnv } from "dotenv";
import { defineConfig } from "vitest/config";

/**
 * Vitest does not read .env.local. Next does, and so does the Playwright
 * config, and the shell scripts source it.
 *
 * That gap is why the schema, RLS and insert suites failed with "Cannot reach
 * Postgres" on a machine whose ELVT_DB_URL lived in .env.local: the tests read
 * process.env, found nothing, and fell back to the Supabase default port that
 * nothing is listening on. An export in one shell fixed it for that shell only.
 */
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
  },
});

import { config as loadEnv } from "dotenv";
import { defineConfig } from "vitest/config";

/**
 * The integration suite. Separate from the unit config because it needs a
 * running PostgREST, runs one file at a time against a shared database, and
 * takes long enough that it should not be in the loop a developer runs on
 * every save.
 */
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    // One at a time. These write real rows into one database, and two files
    // racing over the same tables is a flake nobody can reproduce.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});

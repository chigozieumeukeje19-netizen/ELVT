import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");

/**
 * These run against a plain Postgres, not the Supabase stack, so the schema can
 * be checked anywhere psql and a server are available. `supabase db reset` is
 * the real path once Docker is reachable; this proves the same SQL.
 */
function run(script: string): string {
  return execFileSync("bash", [path.join(root, "scripts", script)], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, VERIFY_DB: process.env.VERIFY_DB ?? "elvt_verify" },
  });
}

const hasPsql = (() => {
  try {
    execFileSync("psql", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!hasPsql)("schema", () => {
  it("applies every migration and the seed cleanly", () => {
    const out = run("verify-migrations.sh");
    expect(out).toContain("Migrations applied cleanly.");
    expect(out).toContain("Clients seeded:");
    // Eight synthetic clients, one coach.
    expect(out).toMatch(/client:\s*8/);
    expect(out).toMatch(/coach:\s*1/);
  }, 120_000);

  it("leaves no table in public without row level security", () => {
    const out = run("verify-migrations.sh");
    expect(out).toMatch(/Tables in public WITHOUT RLS \(must be empty\):\s*\n\s*none/);
  }, 120_000);

  it("enforces the RLS policies", () => {
    const out = run("rls-check.sh");
    expect(out).toContain("RLS checks passed");
    expect(out).not.toContain("FAILED:");
  }, 120_000);
});

describe("repository shape", () => {
  it("keeps the seed free of anything that looks like a real roster name", () => {
    const seed = require("node:fs").readFileSync(
      path.join(root, "supabase", "seed.sql"),
      "utf8",
    );
    // The spec names real clients in its worked examples. None of them belong
    // in a seed file.
    for (const name of ["Janessa", "Karar", "Andi", "Rodrigo"]) {
      expect(seed).not.toContain(name);
    }
  });

  it("never links to the retired Supabase project", () => {
    for (const file of ["supabase/config.toml", ".env.example"]) {
      const full = path.join(root, file);
      if (!existsSync(full)) continue;
      const body = require("node:fs").readFileSync(full, "utf8");
      expect(body).not.toContain("ffgajrabbctogsyiyqvn");
    }
  });
});

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../..");

const hasPsql = (() => {
  try {
    execFileSync("psql", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

/**
 * Its own database. The schema suite drops and recreates elvt_verify, and
 * vitest runs files in parallel, so sharing one would have these two tearing
 * the database out from under each other.
 */
const DB = "elvt_shim_check";

function run(script: string): string {
  return execFileSync("bash", [path.join(ROOT, "scripts", script)], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, VERIFY_DB: DB },
  });
}

/** Builds the database this file reads: shim, migrations, seed. */
function build(): string {
  return run("verify-migrations.sh");
}

/**
 * Every `insert into <table> (col, col, ...)` in a SQL file, as
 * table -> columns. Only the explicit column list form is parsed, which is the
 * only form the seed uses; an insert without one would be a separate problem.
 */
function insertTargets(sql: string): Map<string, string[]> {
  const targets = new Map<string, string[]>();
  const pattern = /insert\s+into\s+([\w.]+)\s*\(([^)]*)\)/gis;

  for (const match of sql.matchAll(pattern)) {
    const table = match[1].toLowerCase();
    const columns = match[2]
      .split(",")
      .map((c) => c.trim().toLowerCase())
      .filter((c) => c && /^[\w"]+$/.test(c));

    targets.set(table, [...(targets.get(table) ?? []), ...columns]);
  }

  return targets;
}

describe("the seed never writes a generated column", () => {
  /**
   * This is the guard for the bug that got through: auth.identities.email is
   * GENERATED ALWAYS, the shim carried it as a plain column, the seed wrote to
   * it, and everything passed locally before failing on the real stack with
   * SQLSTATE 428C9.
   *
   * Rather than pinning that one column forever, this asks the database which
   * columns are generated and checks the seed against the answer, so the next
   * one cannot repeat the trick.
   */
  it.skipIf(!hasPsql)("for any generated column in auth or public", () => {
    // The seed has to have actually run, or a passing check would only mean
    // the insert was never attempted.
    expect(build()).toContain("Migrations applied cleanly.");

    const output = run("shim-conformance.sh");

    const generated = output
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^(auth|public)\.[\w.]+$/.test(line));

    // If this is empty the query broke, and a passing test would mean nothing.
    expect(
      generated.length,
      "no generated columns found, so this test proves nothing",
    ).toBeGreaterThan(0);
    expect(generated).toContain("auth.identities.email");

    const seed = readFileSync(path.join(ROOT, "supabase", "seed.sql"), "utf8");
    const targets = insertTargets(seed);

    const offenders: string[] = [];
    for (const qualified of generated) {
      const parts = qualified.split(".");
      const column = parts.pop()!;
      const table = parts.join(".");

      for (const [target, columns] of targets) {
        const matches =
          target === table || target === table.replace(/^public\./, "");
        if (matches && columns.includes(column)) {
          offenders.push(`${table} insert names generated column ${column}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  }, 120_000);

  it.skipIf(!hasPsql)("and the shim declares them generated", () => {
    const output = run("shim-conformance.sh");
    expect(output).toContain("ok: auth.identities.email is a generated column");
    expect(output).toContain("ok: auth.users.confirmed_at is a generated column");
    expect(output).not.toContain("SHIM DIVERGENCE");
  }, 120_000);
});

describe("every auth helper the migrations call exists in the shim", () => {
  /**
   * The migrations call into the auth schema. If the shim is missing one of
   * those functions, or has it under a different signature, the policies pass
   * here and fail on the real stack. Same class as the generated column.
   */
  it.skipIf(!hasPsql)("with no missing function", () => {
    const migrations = execFileSync(
      "bash",
      ["-lc", `cat ${path.join(ROOT, "supabase/migrations")}/*.sql`],
      { encoding: "utf8" },
    );

    const called = [
      ...new Set(
        [...migrations.matchAll(/\bauth\.([a-z_]+)\s*\(/g)].map((m) => m[1]),
      ),
    ];

    expect(called.length, "no auth helpers found, so this proves nothing")
      .toBeGreaterThan(0);
    expect(called).toContain("uid");

    const query = (sql: string) =>
      execFileSync(
        "psql",
        [
          "-h", process.env.PGHOST ?? "127.0.0.1",
          "-p", process.env.PGPORT ?? "5433",
          "-U", process.env.PGUSER ?? "postgres",
          "-d", DB,
          "-t", "-A", "-c", sql,
        ],
        { encoding: "utf8" },
      )
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

    const functions = query(
      "select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'auth'",
    );

    // `references auth.users (id)` looks like a call to the pattern above but
    // is a table, so anything that is a real table is not a missing function.
    const tables = query(
      "select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'auth'",
    );

    const missing = called.filter(
      (name) => !functions.includes(name) && !tables.includes(name),
    );
    expect(missing).toEqual([]);
  }, 120_000);
});

describe("the seed parser", () => {
  // The guard above is only as good as this, so it gets its own controls.
  it("reads a column list off an insert", () => {
    const targets = insertTargets(
      "insert into auth.identities (provider_id, user_id, email) select 1;",
    );
    expect(targets.get("auth.identities")).toEqual([
      "provider_id",
      "user_id",
      "email",
    ]);
  });

  it("reads a list that spans several lines", () => {
    const targets = insertTargets(`
      insert into auth.users (
        id, instance_id,
        email
      )
      select 1;
    `);
    expect(targets.get("auth.users")).toContain("email");
  });

  it("would have caught the original bug", () => {
    const before =
      "insert into auth.identities (provider_id, user_id, identity_data, provider, email, last_sign_in_at)";
    expect(insertTargets(before).get("auth.identities")).toContain("email");
  });

  it("does not flag the fixed version", () => {
    const after =
      "insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at)";
    expect(insertTargets(after).get("auth.identities")).not.toContain("email");
  });
});

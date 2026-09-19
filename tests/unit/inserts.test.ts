import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { requireDatabase, urlFor } from "../helpers/db";

const root = path.resolve(__dirname, "../..");

/**
 * Every insert in the app, checked against the columns the database actually
 * requires.
 *
 * TypeScript cannot see this. The Supabase client is untyped in this project,
 * so `.insert({})` compiles for any table and any shape, and a missing NOT NULL
 * column surfaces as a runtime error on a write path nobody exercises until a
 * client does.
 *
 * That is not hypothetical. The check-in review wrote a messages row without
 * client_id, which is not null and is what the RLS policy for the client role
 * reads. It typechecked, it built, and it would have failed the first time a
 * coach reviewed a check-in.
 *
 * So the schema is read from the live database and the inserts are read from
 * the source, and the two are compared.
 */

const VERIFY_DB = process.env.VERIFY_DB ?? "elvt_verify";

type Required = Map<string, Set<string>>;

function psql(sql: string): string {
  return execFileSync("psql", [urlFor(VERIFY_DB), "-Atc", sql], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/**
 * Columns that must be supplied: not null, no default, and not generated.
 * A column with a default is supplied by the database, so leaving it out is
 * correct rather than a bug.
 */
function requiredColumns(): Required {
  const out = psql(`
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and is_nullable = 'NO'
      and column_default is null
      and is_generated = 'NEVER'
      and is_identity = 'NO'
    order by table_name, column_name
  `);

  const map: Required = new Map();
  for (const line of out.trim().split("\n").filter(Boolean)) {
    const [table, column] = line.split("|");
    if (!map.has(table)) map.set(table, new Set());
    map.get(table)!.add(column);
  }
  return map;
}

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry)) found.push(full);
  }
  return found;
}

type Insert = { file: string; table: string; keys: string[]; spread: boolean };

/**
 * Finds every `.insert(` and the table it belongs to.
 *
 * Scanned backwards from the insert rather than forwards from the from, which
 * is how the first version of this got it wrong: a forward non greedy match
 * pairs the earliest `.from` in range with the next `.insert`, so a second
 * insert further down was matched against the wrong table and then discarded.
 * It found five inserts in a file with seven and reported everything as fine.
 *
 * Deliberately conservative about the object. An insert whose argument is not
 * an object literal, or which spreads something in, cannot be read statically,
 * so it is recorded as a spread and skipped rather than guessed at.
 */
function findInserts(source: string, file: string): Insert[] {
  const inserts: Insert[] = [];

  for (let at = source.indexOf(".insert("); at !== -1; at = source.indexOf(".insert(", at + 1)) {
    // The nearest .from before this insert is the table it writes to.
    const before = source.slice(Math.max(0, at - 400), at);
    const froms = [...before.matchAll(/\.from\(\s*["'`]([a-z_]+)["'`]\s*\)/g)];
    if (froms.length === 0) continue;
    const table = froms[froms.length - 1][1];

    const start = at + ".insert(".length;
    const open = source.indexOf("{", start);
    if (open === -1 || open > start + 20) continue;

    let depth = 0;
    let end = -1;
    for (let i = open; i < source.length; i += 1) {
      if (source[i] === "{") depth += 1;
      if (source[i] === "}") {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) continue;

    const body = source.slice(open + 1, end);
    const spread = body.includes("...");

    // Top level keys only. Nested objects are jsonb values, not columns.
    const keys: string[] = [];
    let nesting = 0;
    for (const line of body.split("\n")) {
      const trimmed = line.trim();
      if (nesting === 0) {
        const key = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:/);
        if (key) keys.push(key[1]);
      }
      nesting += (line.match(/[{[(]/g) ?? []).length;
      nesting -= (line.match(/[}\])]/g) ?? []).length;
    }

    inserts.push({ file: path.relative(root, file), table, keys, spread });
  }

  return inserts;
}

describe("every insert supplies the columns the database requires", () => {
  beforeAll(() => requireDatabase());

  let required: Required;
  let inserts: Insert[];

  beforeAll(() => {
    // Built by the migration verifier, which the schema suite runs first.
    execFileSync("bash", [path.join(root, "scripts", "verify-migrations.sh")], {
      stdio: "ignore",
      env: { ...process.env, VERIFY_DB },
    });

    required = requiredColumns();
    inserts = sourceFiles(path.join(root, "src")).flatMap((file) =>
      findInserts(readFileSync(file, "utf8"), file),
    );
  }, 180_000);

  it("finds the inserts at all, so a passing run is not an empty one", () => {
    // A parser that silently matches nothing would pass forever.
    expect(inserts.length).toBeGreaterThan(5);
    expect(required.size).toBeGreaterThan(10);
  });

  it("names any insert missing a required column", () => {
    const problems: string[] = [];

    for (const insert of inserts) {
      if (insert.spread) continue;

      const needed = required.get(insert.table);
      if (!needed) continue;

      const missing = [...needed].filter((column) => !insert.keys.includes(column));
      if (missing.length > 0) {
        problems.push(
          `${insert.file}: insert into ${insert.table} is missing ${missing.join(", ")}`,
        );
      }
    }

    expect(problems).toEqual([]);
  });

  it("only ever names a table that exists", () => {
    const unknown = inserts
      .filter((insert) => !required.has(insert.table))
      .map((insert) => `${insert.file}: ${insert.table}`);

    // Tables with no required columns are legitimately absent from the map, so
    // this is checked against the full table list instead.
    const tables = new Set(
      psql(
        "select table_name from information_schema.tables where table_schema = 'public'",
      )
        .trim()
        .split("\n")
        .filter(Boolean),
    );

    expect(unknown.filter((entry) => !tables.has(entry.split(": ")[1]))).toEqual([]);
  });
});

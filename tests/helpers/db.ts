import { execFileSync } from "node:child_process";

/**
 * The same single connection setting the shell scripts read.
 *
 * Defaults to the local Supabase stack, because that is what every machine
 * running this project has. A container with no Supabase overrides ELVT_DB_URL;
 * nothing else should need to.
 */
export const DB_URL =
  process.env.ELVT_DB_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

/** Swaps the database name, keeping host, credentials and any query string. */
export function urlFor(database: string): string {
  const [withoutQuery, query] = DB_URL.split("?", 2);
  const base = withoutQuery.slice(0, withoutQuery.lastIndexOf("/"));
  return `${base}/${database}${query ? `?${query}` : ""}`;
}

/** The connection string with the password removed, for messages. */
export function displayUrl(): string {
  return DB_URL.replace(/:\/\/([^:/@]+):[^@]*@/, "://$1:****@");
}

export function postgresIsReachable(): boolean {
  try {
    execFileSync("psql", [DB_URL, "-Atc", "select 1"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Fails the suite with something a person can act on.
 *
 * Deliberately a failure and not a skip. The schema and RLS suites are the
 * only thing standing between a broken migration and production, and a silent
 * skip on them is indistinguishable from a pass. Skipped is not passed.
 */
export function requireDatabase(): void {
  if (postgresIsReachable()) return;

  throw new Error(
    [
      "",
      "Cannot reach Postgres, so the schema and RLS tests cannot run.",
      "",
      `  Tried:    ${displayUrl()}`,
      "  Setting:  ELVT_DB_URL",
      "",
      "This defaults to the local Supabase stack. If it is not running:",
      "",
      "  supabase start",
      "",
      "If Supabase is on a different port, check with `supabase status` and",
      "export the connection string it prints. On a machine with no Supabase,",
      "point ELVT_DB_URL at a plain Postgres instead, for example:",
      "",
      "  export ELVT_DB_URL='postgresql://postgres@127.0.0.1:5433/postgres'",
      "",
      "See docs/LOCAL_VS_PRODUCTION.md.",
      "",
    ].join("\n"),
  );
}

export function query(database: string, sql: string): string[] {
  return execFileSync("psql", [urlFor(database), "-t", "-A", "-c", sql], {
    encoding: "utf8",
  })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SignJWT } from "jose";

/**
 * The integration harness.
 *
 * These tests run against real PostgREST with real rows, because every
 * persistence layer in this build had unit tests for the planner beside it and
 * nothing at all for the half that reads and writes. A planner given the wrong
 * numbers produces a confident wrong answer, and nothing was checking which
 * numbers it got.
 *
 * Two ways to get PostgREST, in this order:
 *
 *   1. A running Supabase stack, which is the real thing and what production
 *      is. Used when NEXT_PUBLIC_SUPABASE_URL answers.
 *   2. A bare PostgREST binary against the throwaway verification database,
 *      for a machine that cannot run Docker. Same wire protocol, same RLS,
 *      same role switching; only the mount path differs, and the runner puts
 *      it behind /rest/v1 so nothing in the tests knows the difference.
 *
 * With neither, the suite FAILS. It does not skip. A persistence test that
 * quietly does not run is worse than no test, because the report says the
 * layer is covered.
 */

export const REST_URL = process.env.ELVT_REST_URL ?? "";
export const REST_KIND = process.env.ELVT_REST_KIND ?? "";

/**
 * Fails the suite with something a person can act on.
 *
 * Deliberately a throw at import time rather than a skip. See above.
 */
export function requireRest(): void {
  if (REST_URL) return;

  throw new Error(
    [
      "",
      "No PostgREST, so the integration tests cannot run.",
      "",
      "They are the only tests that prove the queries behind the week roll,",
      "the trigger engine, the Monday cards, the dispatchers and the photo",
      "gallery read the right rows. Skipping them would report a layer as",
      "covered that nothing has ever exercised.",
      "",
      "Run them with either:",
      "",
      "  supabase start && npm run test:integration",
      "",
      "or, on a machine with no Docker, point POSTGREST_BIN at a PostgREST",
      "binary and the runner builds its own database:",
      "",
      "  POSTGREST_BIN=/usr/local/bin/postgrest npm run test:integration",
      "",
      "Set by scripts/integration.sh. If you are seeing this from a bare",
      "`vitest run`, use the command above instead.",
      "",
    ].join("\n"),
  );
}

export type ClientOptions = {
  /**
   * Runs before each request the client makes, with the URL and the init it is
   * about to send. Used by one test to inject the window between a read and a
   * guarded write, which is the race two overlapping dispatcher ticks open.
   */
  beforeFetch?: (url: string, init: RequestInit | undefined) => Promise<void> | void;
};

/** A service role client against whichever PostgREST the runner started. */
export async function serviceClient(options: ClientOptions = {}): Promise<SupabaseClient> {
  requireRest();

  const key =
    process.env.ELVT_REST_KEY ??
    (await new SignJWT({ role: "service_role" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("2h")
      .sign(new TextEncoder().encode(requiredEnv("SUPABASE_JWT_SECRET"))));

  return createClient(REST_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    // A bare PostgREST serves /<table>; Supabase mounts it behind /rest/v1.
    // The tests use the real client either way, so the prefix is dropped here
    // rather than special cased in every test. Nothing else about the request
    // changes: same protocol, same roles, same RLS.
    global: { fetch: makeFetch(options) },
  });
}

function makeFetch(options: ClientOptions): typeof fetch {
  const prefixless = Boolean(process.env.ELVT_REST_PREFIXLESS);

  return async (input, init) => {
    const raw =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const url = prefixless ? raw.replace("/rest/v1/", "/") : raw;

    if (options.beforeFetch) await options.beforeFetch(url, init ?? undefined);

    return fetch(url, init);
  };
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set, so a token cannot be signed.`);
  return value;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * Every row a test makes, so it can be taken away again.
 *
 * Clients cascade, so deleting the client removes almost everything. The few
 * tables that do not hang off a client are tracked by hand.
 */
const madeClients: string[] = [];

export function trackClient(id: string): string {
  madeClients.push(id);
  return id;
}

/**
 * A client row, with a slug nothing else will collide with.
 *
 * Built rather than looked up in the seed. A test that looks for a seeded
 * client and skips when it is missing is the silent green this project keeps
 * finding, and the seed carries only clients and check-in forms anyway.
 */
export async function makeClient(
  supabase: SupabaseClient,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string; slug: string }> {
  const id = randomUUID();
  const slug = `it-${id.slice(0, 8)}`;

  const { error } = await supabase.from("clients").insert({
    id,
    slug,
    first_name: "Integration",
    last_name: "Fixture",
    sex: "undisclosed",
    units: "imperial",
    status: "active",
    timezone: "America/New_York",
    program_length_weeks: 12,
    primary_goal: "recomp",
    goal_statement: "A fixture, not a person.",
    ...overrides,
  });

  if (error) throw new Error(`Could not make a fixture client: ${error.message}`);

  trackClient(id);
  return { id, slug };
}

/** Removes every fixture client, and with them everything that cascades. */
export async function cleanup(supabase: SupabaseClient): Promise<void> {
  if (madeClients.length === 0) return;

  const { error } = await supabase.from("clients").delete().in("id", madeClients);
  if (error) throw new Error(`Cleanup failed, so the next run starts dirty: ${error.message}`);

  madeClients.length = 0;
}

/**
 * Rows this service role client can reach at all.
 *
 * Called once per file as a proof that the client really is talking to
 * PostgREST with a working service role, rather than to something that
 * cheerfully returns an empty array for every query. An empty array is what a
 * broken connection and a real empty table both look like, and only one of
 * them should pass.
 */
export async function assertRestIsLive(supabase: SupabaseClient): Promise<void> {
  const { error, count } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true });

  if (error) {
    throw new Error(
      `PostgREST answered but the service role cannot read clients: ${error.message}`,
    );
  }
  if (count === null) {
    throw new Error("PostgREST returned no row count, so this is not a working connection.");
  }
}

/** psql against the same database, for the handful of things PostgREST cannot do. */
export function psql(sql: string): string {
  const url = process.env.ELVT_REST_DB_URL;
  if (!url) throw new Error("ELVT_REST_DB_URL is not set, so psql cannot reach the test database.");
  return execFileSync("psql", [url, "-Atc", sql], { encoding: "utf8" }).trim();
}

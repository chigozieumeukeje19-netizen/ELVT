import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { requireDatabase } from "../helpers/db";

const root = path.resolve(__dirname, "../..");
const API = path.join(root, "src/app/api/v1");
const VERIFY_DB = process.env.API_DB ?? "elvt_api";

/**
 * The client API.
 *
 * Two kinds of check, because Part 11.2 asks for two different things.
 *
 * The structural ones read the routes and assert they cannot bypass RLS. The
 * SQL ones run every endpoint's read and write against another client's row, as
 * PostgREST does, with no route handler involved. A route that filtered by hand
 * with the service role would pass every happy path test ever written and fail
 * the SQL ones, which is why both are here.
 */

function routes(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...routes(full));
    else if (entry === "route.ts") found.push(full);
  }
  return found;
}

/** The endpoints Part 11.2 names, as path patterns under /api/v1. */
const REQUIRED = [
  "auth/exchange", "auth/magic-link",
  "me", "today", "week/[n]", "program", "session/[id]",
  "exercise/[id]/history", "nutrition/[date]", "progress", "checkins",
  "messages", "milestones",
  "session/[id]/start", "session/[id]/complete", "session/[id]/skip",
  "set-log", "session/[id]/swap-exercise", "session/[id]/customize",
  "run-log", "day/[date]/task", "habit-log", "meal-log",
  "day/[date]/target-override", "daily-log",
  "checkin/[id]/submit", "checkin/[id]/reply",
  "message", "message/[id]/read", "day-swap", "photos", "device",
];

describe("the endpoints Part 11.2 names", () => {
  const present = routes(API).map((file) =>
    path.relative(API, path.dirname(file)).split(path.sep).join("/"),
  );

  it.each(REQUIRED)("/api/v1/%s exists", (route) => {
    expect(present).toContain(route);
  });

  it("has no route nobody asked for", () => {
    expect(present.filter((route) => !REQUIRED.includes(route))).toEqual([]);
  });
});

describe("no client endpoint can bypass RLS", () => {
  const files = routes(API);

  it("finds the routes at all, so a passing run is not an empty one", () => {
    expect(files.length).toBeGreaterThanOrEqual(REQUIRED.length);
  });

  it.each(
    routes(API).map((file) => [path.relative(root, file), file] as const),
  )("%s does not reach for the service role", (name, file) => {
    const source = readFileSync(file, "utf8");

    // auth/exchange is the one endpoint that legitimately holds it: it runs
    // before any client token exists, authenticated by the portal API key, and
    // its whole job is to look a client up in order to mint one.
    if (name.includes("auth/exchange")) {
      expect(source).toContain("supabaseAdmin");
      return;
    }

    expect(source, `${name} imports the service role client`).not.toContain("supabaseAdmin");
    expect(source, `${name} reads the service role key`).not.toContain(
      "SUPABASE_SERVICE_ROLE_KEY",
    );
  });

  it.each(
    routes(API)
      .filter((file) => !file.includes("auth/"))
      .map((file) => [path.relative(root, file), file] as const),
  )("%s goes through the client context", (name, file) => {
    const source = readFileSync(file, "utf8");
    // Every non auth route is wrapped, which is what puts the caller's own JWT
    // on the Supabase client and hands the decision to the policies.
    // The generic argument sits between the name and the paren on the
    // dynamic routes, so the pattern has to allow it.
    expect(source, `${name} is not wrapped`).toMatch(
      /handler(WithParams)?(<[^>]*>)?\(/,
    );
  });
});

describe("every endpoint is bounded at the RLS layer", () => {
  beforeAll(() => requireDatabase());

  let output = "";

  beforeAll(() => {
    execFileSync("bash", [path.join(root, "scripts", "verify-migrations.sh")], {
      stdio: "ignore",
      env: { ...process.env, VERIFY_DB },
    });

    // psql writes its NOTICEs to stderr, so capturing stdout alone caught none
    // of them and every assertion below failed against an empty string. The
    // first version of this test did exactly that.
    //
    // A failed assertion raises, so psql exits non-zero and execFileSync
    // throws. Its message is "Command failed", which says nothing about which
    // endpoint lost its bound, so the output is pulled back out and put in
    // front of whoever is reading.
    try {
      output = execFileSync(
        "bash",
        ["-c", `bash ${path.join(root, "scripts", "api-rls-check.sh")} 2>&1`],
        { encoding: "utf8", env: { ...process.env, VERIFY_DB } },
      );
    } catch (error) {
      const captured = String(
        (error as { stdout?: string | Buffer }).stdout ?? "",
      );
      const failed = captured
        .split("\n")
        .filter((line) => line.includes("FAILED:") || line.includes("ERROR:"))
        .join("\n");

      throw new Error(
        [
          "",
          "An endpoint lost its bound at the RLS layer.",
          "",
          failed || captured.split("\n").slice(-20).join("\n"),
          "",
          "Run it directly to see everything it checked:",
          "",
          "  npm run db:api-rls",
          "",
        ].join("\n"),
      );
    }
  }, 240_000);

  it("runs every assertion rather than skipping any", () => {
    // The first version of this file looked its fixtures up in the seed and
    // skipped when it found none. The seed carries clients and check-in forms
    // and nothing else, so most of the write assertions never ran and the file
    // reported a pass. Everything is built now, and this counts them.
    const ran = output.split("\n").filter((line) => line.includes("ok:")).length;
    expect(ran).toBeGreaterThanOrEqual(35);
  });

  it("proves a client cannot read another client's rows", () => {
    for (const endpoint of [
      "GET /me", "GET /program", "GET /week/:n", "GET /today", "GET /session/:id",
      "GET /exercise/:id/history", "GET /nutrition/:date", "GET /progress",
      "GET /checkins", "GET /messages", "GET /milestones",
    ]) {
      expect(output, endpoint).toContain(`ok: ${endpoint}`);
    }
  });

  it("proves a client cannot write another client's rows", () => {
    for (const endpoint of [
      "POST /session/:id/complete", "POST /session/:id/swap-exercise",
      "POST /day/:date/target-override", "POST /set-log", "POST /run-log",
      "POST /daily-log", "POST /habit-log", "POST /meal-log",
      "POST /day/:date/task", "POST /checkin/:id/submit", "POST /message",
      "POST /photos", "POST /device", "POST /day-swap",
    ]) {
      expect(output, endpoint).toContain(`ok: ${endpoint}`);
    }
  });

  it("proves a client cannot sign a message as someone else", () => {
    expect(output).toContain("ok: POST /message cannot be signed as another user");
  });

  it("proves the column bounds, which no policy can give", () => {
    // A policy decides which rows. Only a grant decides which columns, and a
    // client must not be able to rename a session or rewrite their prescription
    // while legitimately swapping a movement.
    expect(output).toContain("ok: a client may only move the two override columns");
    expect(output).toContain("ok: a client may only swap the movement, never the prescribed sets");
    expect(output).toContain("ok: a client cannot rename a session");
  });
});

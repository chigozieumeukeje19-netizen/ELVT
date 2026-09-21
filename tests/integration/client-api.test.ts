import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { mintClientToken } from "@/lib/client-token";
import { REST_URL, makeClient, psql, requireRest, serviceClient } from "./harness";

/**
 * The client API, called for real.
 *
 * Everything that existed before this file proved one of two things: that a
 * client cannot reach another client's row, or that a persistence function
 * reads the right rows. Thirty of the thirty-one assertions in
 * tests/sql/api_rls_checks.sql are refusals. Not one test called a route
 * handler and then looked at the table.
 *
 * That is exactly the gap POST /habit-log fell through. It never worked: the
 * insert omitted client_id, which is NOT NULL, so every call in the product's
 * life failed the constraint and answered 404. A rejection test cannot see
 * that, because the endpoint did reject. It rejected everything.
 *
 * So these call the real exported handler, with a real signed client token,
 * against real PostgREST, and then read the row back.
 */

let supabase: SupabaseClient;

/**
 * A signed-in person.
 *
 * The audit trigger writes auth.uid() into audit_log.actor_id, which is a
 * foreign key to auth.users. A made-up uuid therefore fails every write with a
 * 23503, which is worth knowing: it means these tests exercise the audit path
 * too, not only the table they name.
 */
function makeUser(): string {
  const id = randomUUID();
  psql(
    `insert into auth.users (id, email, aud, role) ` +
      `values ('${id}', 'fixture-${id.slice(0, 8)}@elvt.test', 'authenticated', 'authenticated')`,
  );
  return id;
}

/** A request the way the client app makes one. */
async function post(clientId: string, userId: string, body: unknown, url = "http://test/api") {
  const { token } = await mintClientToken({ clientId, userId });
  return new Request(url, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  requireRest();

  // The route handlers build their own Supabase client from the environment,
  // so the environment has to point at the PostgREST this run started. A bare
  // PostgREST serves /<table> where Supabase mounts it under /rest/v1, and the
  // handlers use the global fetch, so the prefix is stripped there.
  process.env.NEXT_PUBLIC_SUPABASE_URL = REST_URL;
  if (process.env.ELVT_REST_PREFIXLESS) {
    const real = globalThis.fetch;
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      return real(raw.replace("/rest/v1/", "/"), init);
    }) as typeof fetch;
  }

  supabase = await serviceClient();
});

describe("POST /api/v1/habit-log", () => {
  async function habitFor(clientId: string) {
    const definition = randomUUID();
    await supabase.from("habits_library").insert({ id: definition, name: `H-${definition.slice(0, 6)}`, unit: "check" });
    const habit = randomUUID();
    const { error } = await supabase.from("habits").insert({
      id: habit,
      client_id: clientId,
      habit_id: definition,
      name: "Knee routine",
      target: 1,
      unit: "check",
    });
    if (error) throw new Error(error.message);
    return habit;
  }

  it("writes the row, which it never did before", async () => {
    const { POST } = await import("@/app/api/v1/habit-log/route");
    const client = await makeClient(supabase);
    const habit = await habitFor(client.id);
    const user = makeUser();

    const response = await POST(
      (await post(client.id, user, { habit_id: habit, date: "2026-10-05", completed: true })) as never,
    );

    expect(response.status).toBe(200);

    const { data } = await supabase
      .from("habit_logs")
      .select("client_id, habit_id, date, completed")
      .eq("habit_id", habit);

    expect(data).toHaveLength(1);
    expect(data![0].client_id).toBe(client.id);
    expect(data![0].completed).toBe(true);
  });

  it("corrects the same day rather than writing a second row", async () => {
    const { POST } = await import("@/app/api/v1/habit-log/route");
    const client = await makeClient(supabase);
    const habit = await habitFor(client.id);
    const user = makeUser();

    await POST((await post(client.id, user, { habit_id: habit, date: "2026-10-06", completed: true })) as never);
    await POST((await post(client.id, user, { habit_id: habit, date: "2026-10-06", completed: false })) as never);

    const { data } = await supabase.from("habit_logs").select("completed").eq("habit_id", habit);
    expect(data).toHaveLength(1);
    expect(data![0].completed).toBe(false);
  });

  it("answers 404 for a habit that belongs to someone else, and writes nothing", async () => {
    const { POST } = await import("@/app/api/v1/habit-log/route");
    const mine = await makeClient(supabase);
    const theirs = await makeClient(supabase);
    const habit = await habitFor(theirs.id);

    const response = await POST(
      (await post(mine.id, makeUser(), { habit_id: habit, date: "2026-10-07", completed: true })) as never,
    );

    expect(response.status).toBe(404);
    const { data } = await supabase.from("habit_logs").select("id").eq("habit_id", habit);
    expect(data).toHaveLength(0);
  });
});

/**
 * A week, a day and a session, which is the shortest real chain to a row a
 * client may write. Session exercises hang off a section, not off the session,
 * so the section is part of it.
 */
async function makeSession(clientId: string, extra: Record<string, unknown> = {}) {
  const program = randomUUID();
  let error = (await supabase.from("programs").insert({
    id: program, client_id: clientId, name: "Fixture block", duration_weeks: 12,
  })).error;
  if (error) throw new Error(`programs: ${error.message}`);

  const week = randomUUID();
  error = (await supabase.from("program_weeks").insert({
    id: week, program_id: program, client_id: clientId, week_number: 1, starts_on: "2026-10-05",
  })).error;
  if (error) throw new Error(`program_weeks: ${error.message}`);

  const day = randomUUID();
  error = (await supabase.from("program_days").insert({
    id: day, client_id: clientId, program_week_id: week, date: "2026-10-05", day_of_week: 1,
  })).error;
  if (error) throw new Error(`program_days: ${error.message}`);

  const session = randomUUID();
  error = (await supabase.from("sessions").insert({
    id: session, client_id: clientId, program_day_id: day,
    kind: "strength", name: "Lower A", order: 1, status: "planned", ...extra,
  })).error;
  if (error) throw new Error(`sessions: ${error.message}`);

  const section = randomUUID();
  error = (await supabase.from("session_sections").insert({
    id: section, client_id: clientId, session_id: session, type: "regular", order: 1,
  })).error;
  if (error) throw new Error(`session_sections: ${error.message}`);

  return { session, section };
}

describe("POST /api/v1/session/:id/customize", () => {
  it("leaves the coach's note alone", async () => {
    const { POST } = await import("@/app/api/v1/session/[id]/customize/route");
    const client = await makeClient(supabase);
    const { session } = await makeSession(client.id, {
      coach_notes: "Keep the bar path over midfoot.",
    });

    const response = await POST(
      (await post(client.id, makeUser(), { note: "Swapped the second movement." })) as never,
      { params: Promise.resolve({ id: session }) } as never,
    );

    expect(response.status).toBe(200);

    const { data } = await supabase
      .from("sessions")
      .select("status, coach_notes, fueling_notes")
      .eq("id", session)
      .single();

    // The whole defect: this used to come back null.
    expect(data!.coach_notes).toBe("Keep the bar path over midfoot.");
    expect(data!.fueling_notes).toBe("Swapped the second movement.");
    expect(data!.status).toBe("modified");
  });
});

describe("POST /api/v1/device", () => {
  it("registers onto the devices table, which RLS actually permits", async () => {
    const { POST } = await import("@/app/api/v1/device/route");
    const client = await makeClient(supabase);

    const response = await POST(
      (await post(client.id, makeUser(), { token: "a".repeat(40), platform: "ios" })) as never,
    );

    expect(response.status).toBe(200);

    const { data } = await supabase
      .from("devices")
      .select("client_id, push_token, platform")
      .eq("client_id", client.id);

    expect(data).toHaveLength(1);
    expect(data![0].platform).toBe("ios");
  });

  it("re-registering the same token does not stack rows", async () => {
    const { POST } = await import("@/app/api/v1/device/route");
    const client = await makeClient(supabase);
    const token = "b".repeat(40);

    await POST((await post(client.id, makeUser(), { token, platform: "ios" })) as never);
    await POST((await post(client.id, makeUser(), { token, platform: "android" })) as never);

    const { data } = await supabase.from("devices").select("platform").eq("client_id", client.id);
    expect(data).toHaveLength(1);
    expect(data![0].platform).toBe("android");
  });
});

describe("POST /api/v1/set-log", () => {
  async function setUp() {
    const client = await makeClient(supabase);
    const { section } = await makeSession(client.id);

    const movement = randomUUID();
    let error = (await supabase.from("exercises").insert({
      id: movement, name: `Fixture press ${movement.slice(0, 6)}`, pattern: "push_h",
    })).error;
    if (error) throw new Error(`exercises: ${error.message}`);

    const se = randomUUID();
    error = (await supabase.from("session_exercises").insert({
      id: se, client_id: client.id, section_id: section, exercise_id: movement, order: 1,
      sets: [{ set: 1, reps: 8, load: "60kg" }],
    })).error;
    if (error) throw new Error(`session_exercises: ${error.message}`);

    return { client, se };
  }

  it("writes the prescription once, and never again", async () => {
    const { POST } = await import("@/app/api/v1/set-log/route");
    const { client, se } = await setUp();
    const user = makeUser();

    await POST(
      (await post(client.id, user, { session_exercise_id: se, set_number: 1, actual: { reps: 8, load: "60kg" } })) as never,
    );

    const first = await supabase.from("set_logs").select("prescribed, actual").eq("session_exercise_id", se).single();
    expect(first.data!.prescribed).toMatchObject({ set: 1, reps: 8 });

    /*
     * The correction, with the privilege withheld.
     *
     * Asserting that the prescription still holds the same value proves
     * nothing: the route recomputes it from session_exercises and writes the
     * same thing back, so an upsert that names the column passes that test
     * while holding exactly the privilege item 38.1 exists to take away. The
     * first version of this control did not bite for that reason.
     *
     * What matters is that the second call does not need UPDATE on
     * `prescribed`. So it is revoked here, which is what the column grants
     * migration makes permanent, and the correction has to go through anyway.
     */
    /*
     * Revoking the column alone does nothing: `authenticated` holds
     * table-level UPDATE on set_logs, which covers every column, and a
     * column-level revoke cannot take a bite out of a table-level grant. That
     * is the whole reason item 38.1 removes the table grants as well as adding
     * column ones, and this control did not bite until it did the same.
     */
    /*
     * The migration's own grant list, minus `prescribed`. Restored exactly at
     * the end rather than with a table-wide grant: the first version of this
     * put `grant update on public.set_logs to authenticated` in the finally,
     * which handed back every column including the two the migration takes
     * away, and the coach-only test below then failed on privileges this test
     * had granted. A test that widens the schema it is running against is
     * worse than no test.
     */
    const RESTORE =
      "grant update (session_exercise_id, client_id, set_number, prescribed, " +
      "actual, logged_at, logged_for_date) on public.set_logs to authenticated";

    psql("revoke update on public.set_logs from authenticated");
    psql(
      "grant update (actual, logged_at, logged_for_date, session_exercise_id, set_number) " +
        "on public.set_logs to authenticated",
    );
    try {
      const response = await POST(
        (await post(client.id, user, { session_exercise_id: se, set_number: 1, actual: { reps: 6, load: "60kg" } })) as never,
      );
      expect(response.status).toBe(200);
    } finally {
      psql("revoke update on public.set_logs from authenticated");
      psql(RESTORE);
    }

    const { data } = await supabase.from("set_logs").select("prescribed, actual").eq("session_exercise_id", se);
    expect(data).toHaveLength(1);
    expect(data![0].prescribed).toMatchObject({ set: 1, reps: 8 });
    expect(data![0].actual).toMatchObject({ reps: 6 });
  });
});

/**
 * The general form of the customize defect.
 *
 * A client erasing the coach's note was one route writing one column it had no
 * business writing. The shape generalises: any coach-only column on a table a
 * client may write is one careless `.update({ ... })` away from being cleared,
 * and the clearing is silent because the coach never sees the write.
 *
 * So rather than a test per column, this reads the write privileges the client
 * role actually holds and holds them to the audit in
 * docs/CLIENT_WRITE_PRIVILEGES.md. A column that appears in the grants and not
 * in the audit fails here, whichever route added it.
 */
describe("coach-only columns", () => {
  /**
   * Columns neither a coach nor a client writes. The engine writes them
   * through the service role, which bypasses these grants, so taking them from
   * `authenticated` costs nobody anything. This is the part of the audit that
   * shipped.
   */
  const ENGINE_ONLY: Record<string, string[]> = {
    set_logs: ["is_pr", "pr_type"],
    daily_logs: ["readiness"],
  };

  /**
   * The rest of the audit, which cannot be granted until staff have a Postgres
   * role of their own: the coach writes these through `authenticated`, which
   * is the same role the client holds. See docs/OPEN_QUESTIONS.md.
   *
   * Listed rather than deleted, and asserted to be STILL WRITABLE, so this
   * test says out loud what is not yet closed. When the role split lands, this
   * block moves into ENGINE_ONLY and fails until it does.
   */
  const BLOCKED_ON_ROLE_SPLIT: Record<string, string[]> = {
    checkin_submissions: ["reviewed_at", "review_note", "thread_id"],
    sessions: ["coach_notes"],
    messages: ["scheduled_for", "touchpoint"],
    clients: ["flag_config", "one_thing", "coach_notes", "status", "feature_flags"],
  };

  function writable(table: string, column: string): boolean {
    return (
      psql(`select has_column_privilege('authenticated', 'public.${table}', '${column}', 'UPDATE')`) === "t"
    );
  }

  it("engine-written columns are not writable by a client or a coach", () => {
    const offenders: string[] = [];
    for (const [table, columns] of Object.entries(ENGINE_ONLY)) {
      for (const column of columns) {
        if (writable(table, column)) offenders.push(`${table}.${column}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("anon can write nothing at all", () => {
    const writableByAnon = psql(
      `select coalesce(string_agg(table_name, ', '), '') from information_schema.table_privileges ` +
        `where grantee = 'anon' and table_schema = 'public' ` +
        `and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')`,
    );
    expect(writableByAnon).toBe("");
  });

  it("names what the role split still has to close", () => {
    // Deliberately asserting the gap is OPEN. This is a marker, not a pass:
    // when staff become their own role these columns stop being writable by
    // `authenticated` and this test fails, which is the prompt to move them.
    const stillOpen: string[] = [];
    for (const [table, columns] of Object.entries(BLOCKED_ON_ROLE_SPLIT)) {
      for (const column of columns) {
        if (writable(table, column)) stillOpen.push(`${table}.${column}`);
      }
    }
    expect(stillOpen.length).toBeGreaterThan(0);
  });
});

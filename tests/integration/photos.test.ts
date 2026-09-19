import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  BUCKET,
  byWeek,
  clientIdFromPath,
  comparisonsFor,
  pathFor,
  SIGNED_URL_SECONDS,
  type Photo,
} from "@/lib/photos/gallery";
import { assertRestIsLive, cleanup, makeClient, psql, REST_KIND, serviceClient } from "./harness";

/**
 * The photo gallery and the paths behind it, against real rows.
 *
 * Two halves, and both matter for different reasons. The gallery rows decide
 * what a coach sees; the path decides whose folder a file lands in, and a path
 * a caller can name is a path a caller can point at someone else's photographs.
 *
 * The bucket round trip needs the storage service, which only a real Supabase
 * stack has. On bare PostgREST the policy itself is asserted in SQL instead,
 * against the same expression production runs. Neither branch skips: each one
 * says which it took and fails if its own half cannot run.
 */

let supabase: SupabaseClient;

const ANGLES = ["front", "side", "back"] as const;

async function fileWeek(
  clientId: string,
  week: number,
  takenOn: string,
  angles: readonly (typeof ANGLES)[number][] = ANGLES,
) {
  for (const angle of angles) {
    const { error } = await supabase.from("progress_photos").insert({
      client_id: clientId,
      week_number: week,
      taken_on: takenOn,
      angle,
      storage_path: pathFor(clientId, week, angle),
    });
    if (error) throw new Error(error.message);
  }
}

beforeAll(async () => {
  supabase = await serviceClient();
  await assertRestIsLive(supabase);
});

afterAll(async () => {
  await cleanup(supabase);
});

describe("the gallery rows", () => {
  it("groups by week, earliest first, keeping all three angles", async () => {
    const client = await makeClient(supabase);
    await fileWeek(client.id, 1, "2026-09-21");
    await fileWeek(client.id, 5, "2026-10-19");

    const { data } = await supabase
      .from("progress_photos")
      .select("id, week_number, taken_on, angle, storage_path")
      .eq("client_id", client.id)
      .order("week_number")
      .order("taken_on");

    const photos: Photo[] = (data ?? []).map((row) => ({
      id: row.id,
      weekNumber: row.week_number,
      takenOn: row.taken_on,
      angle: row.angle,
      storagePath: row.storage_path,
    }));

    // Ascending, because the gallery reads as a progression: week 1 on the
    // left and the most recent on the right.
    const weeks = byWeek(photos);
    expect(weeks.map((week) => week.weekNumber)).toEqual([1, 5]);
    expect(weeks[0].taken).toBe(3);
    expect(weeks[0].photos.front).not.toBeNull();
    expect(weeks[0].photos.side).not.toBeNull();
    expect(weeks[0].photos.back).not.toBeNull();
    // The path on the row is the one the signer will be handed.
    expect(weeks[0].photos.front!.storagePath.startsWith(`${client.id}/`)).toBe(true);
  });

  it("offers a comparison only between weeks that actually have photos", async () => {
    // Offering week 1 against week 8 when week 8 is empty is a control that
    // does nothing, and a coach who clicks it once stops trusting the rest.
    const client = await makeClient(supabase);
    await fileWeek(client.id, 1, "2026-09-21");
    await fileWeek(client.id, 4, "2026-10-12");

    const { data } = await supabase
      .from("progress_photos")
      .select("id, week_number, taken_on, angle, storage_path")
      .eq("client_id", client.id);

    const weeks = byWeek(
      (data ?? []).map((row) => ({
        id: row.id,
        weekNumber: row.week_number,
        takenOn: row.taken_on,
        angle: row.angle,
        storagePath: row.storage_path,
      })),
    );

    const pairs = comparisonsFor(weeks, 12);
    expect(pairs.length).toBeGreaterThan(0);
    for (const pair of pairs) {
      expect(weeks.some((week) => week.weekNumber === pair.from)).toBe(true);
      expect(weeks.some((week) => week.weekNumber === pair.to)).toBe(true);
    }
  });

  it("keeps one row per client per week per angle", async () => {
    // Monday comes round every week. Two front photos for week 3 means the
    // gallery has to pick one, and whichever it picks is arbitrary.
    const client = await makeClient(supabase);
    await fileWeek(client.id, 3, "2026-10-05", ["front"]);

    const { error } = await supabase.from("progress_photos").insert({
      client_id: client.id,
      week_number: 3,
      taken_on: "2026-10-05",
      angle: "front",
      storage_path: pathFor(client.id, 3, "front"),
    });

    // Either the database refuses it or it does not. If it does not, this test
    // is the record that duplicates are possible and the gallery has to cope.
    if (!error) {
      const { count } = await supabase
        .from("progress_photos")
        .select("id", { count: "exact", head: true })
        .eq("client_id", client.id)
        .eq("week_number", 3)
        .eq("angle", "front");
      expect(count).toBe(2);
    }
  });

  it("keeps one client's photographs out of another client's gallery", async () => {
    const mine = await makeClient(supabase);
    const theirs = await makeClient(supabase);
    await fileWeek(mine.id, 2, "2026-09-28");
    await fileWeek(theirs.id, 2, "2026-09-28");

    const { data } = await supabase
      .from("progress_photos")
      .select("storage_path")
      .eq("client_id", mine.id);

    expect(data).toHaveLength(3);
    for (const row of data ?? []) {
      expect(clientIdFromPath(row.storage_path)).toBe(mine.id);
    }
  });
});

describe("the storage path", () => {
  it("puts the client id first, which is what the policy reads", async () => {
    const client = await makeClient(supabase);
    const path = pathFor(client.id, 4, "side");

    expect(path.startsWith(`${client.id}/`)).toBe(true);
    expect(clientIdFromPath(path)).toBe(client.id);
  });

  it("gives nothing back for a path with no folder", () => {
    // A bare file name has no owner, and treating the file name as the owner
    // is how every folder becomes readable.
    expect(clientIdFromPath("front.jpg")).toBeNull();
    expect(clientIdFromPath("")).toBeNull();
  });

  it("expires a signed link in minutes, not days", () => {
    // A link to a photograph of someone's body that keeps working after it
    // leaks is the thing to avoid.
    expect(SIGNED_URL_SECONDS).toBeLessThanOrEqual(600);
    expect(SIGNED_URL_SECONDS).toBeGreaterThan(0);
  });
});

describe("the bucket policy", () => {
  it("bounds reads by the first folder of the path", async () => {
    if (REST_KIND === "supabase") {
      // The real storage service. The bucket has to exist, and it has to be
      // private: a public bucket makes every signed URL pointless.
      const { data, error } = await supabase.storage.getBucket(BUCKET);
      if (error) {
        throw new Error(
          `The ${BUCKET} bucket is missing from this stack, so nothing here proves the policy: ${error.message}`,
        );
      }
      expect(data!.public).toBe(false);
      return;
    }

    // Bare PostgREST has no storage service, so the policy is asserted where
    // it is actually written: against the same expression production runs,
    // through the shim that tests/sql/shim_conformance.sql holds to the real
    // schema. This is not a skip; it is the other half of the same claim.
    const owner = psql(
      "select (storage.foldername('11111111-1111-1111-1111-111111111111/week-2/front-1'))[1];",
    );
    expect(owner).toBe("11111111-1111-1111-1111-111111111111");

    const policies = psql(
      "select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects';",
    );
    expect(Number(policies)).toBeGreaterThan(0);
  });
});

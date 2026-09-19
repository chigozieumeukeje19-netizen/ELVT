import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadReviewCards } from "@/lib/queue/load-cards";
import { assertRestIsLive, cleanup, makeClient, serviceClient } from "./harness";

/**
 * loadReviewCards, against real rows.
 *
 * The card is assembled from a queue row's detail blob, the client row behind
 * it, the check-in that closed the week and the plan_changes still in draft.
 * Four tables, one screen, and the numbers on it are the ones the coach acts
 * on with a single Accept All.
 */

let supabase: SupabaseClient;

const DETAIL = {
  weekNumber: 3,
  score: 74.5,
  focus: "steps",
  adherence: { training: 100, run: 50, calories: 71, steps: 43, recovery: 86 },
  weight: { average: 176.2, change: -0.6 },
  streak: 5,
  key: "monday:test",
};

/**
 * The frozen week behind a card.
 *
 * The adherence fractions are read off program_weeks rather than out of the
 * queue row, because the card shows "3 of 7" and the detail blob only carries
 * percentages.
 */
async function freezeWeek(clientId: string, weekNumber: number): Promise<void> {
  const { data: program, error } = await supabase
    .from("programs")
    .insert({ client_id: clientId, name: "Block", duration_weeks: 16, status: "active" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { error: weekError } = await supabase.from("program_weeks").insert({
    program_id: program!.id,
    client_id: clientId,
    week_number: weekNumber,
    starts_on: "2026-10-05",
    adherence: {
      training: { done: 4, planned: 4 },
      run: { done: 1, planned: 2 },
      calories: { done: 5, planned: 7 },
      steps: { done: 3, planned: 7 },
      recovery: { done: 6, planned: 7 },
    },
    elvt_score: 74.5,
  });
  if (weekError) throw new Error(weekError.message);
}

async function makeCard(
  clientId: string,
  detail: Record<string, unknown> = DETAIL,
): Promise<string> {
  const { data, error } = await supabase
    .from("queue_items")
    .insert({
      client_id: clientId,
      kind: "monday_review",
      severity: 3,
      title: "Week 3 review",
      detail,
      status: "open",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data!.id;
}

beforeAll(async () => {
  supabase = await serviceClient();
  await assertRestIsLive(supabase);
});

afterAll(async () => {
  await cleanup(supabase);
});

describe("loadReviewCards", () => {
  it("asks for nothing when there is nothing to ask about", async () => {
    // An empty `in` list is a query that returns the whole table in some
    // clients, so this is worth holding rather than assuming.
    expect(await loadReviewCards(supabase, [])).toEqual([]);
  });

  it("reads the numbers out of the row the roll froze", async () => {
    // Not recomputed. The snapshot is the record, and a card that recomputes
    // can disagree with it.
    const client = await makeClient(supabase, { primary_goal: "fat_loss", program_length_weeks: 16 });
    await freezeWeek(client.id, 3);
    const id = await makeCard(client.id);

    const [card] = await loadReviewCards(supabase, [id]);

    expect(card.weekNumber).toBe(3);
    expect(card.weekCount).toBe(16);
    expect(card.score).toBe(74.5);
    expect(card.name).toBe("Integration Fixture");
    expect(card.slug).toBe(client.slug);
    expect(card.weight.average).toBe(176.2);

    // Fractions off the frozen week, not percentages out of the detail blob.
    const steps = card.adherence.find((line) => line.key === "steps")!;
    expect(steps.done).toBe(3);
    expect(steps.planned).toBe(7);
    expect(Math.round(steps.percent!)).toBe(43);
    expect(steps.band).toBe("flag");
  });

  it("leaves out a card that has already been dealt with", async () => {
    const client = await makeClient(supabase);
    const id = await makeCard(client.id);
    await supabase.from("queue_items").update({ status: "done" }).eq("id", id);

    expect(await loadReviewCards(supabase, [id])).toEqual([]);
  });

  it("leaves out a queue row that is not a Monday review", async () => {
    const client = await makeClient(supabase);
    const { data } = await supabase
      .from("queue_items")
      .insert({
        client_id: client.id,
        kind: "trigger",
        severity: 3,
        title: "Steps under",
        detail: { key: "steps:test" },
      })
      .select("id")
      .single();

    expect(await loadReviewCards(supabase, [data!.id])).toEqual([]);
  });

  it("pins the spine question to the top of the check-in", async () => {
    // It is the one that says whether last Monday's change worked, so it is
    // the first thing read rather than somewhere in a list of fifteen.
    const client = await makeClient(supabase);

    const { data: form } = await supabase
      .from("checkin_forms")
      .insert({
        client_id: client.id,
        kind: "weekly",
        // Keys from the bank, which is what all three writers put in this
        // column now. The card resolves them; it used to assume whole objects
        // and rendered an empty check-in for every form written this way.
        questions: ["adherence", "steps", "biggest_struggle"],
        spine_variable: "step_goal",
      })
      .select("id")
      .single();

    await supabase.from("checkin_submissions").insert({
      form_id: form!.id,
      client_id: client.id,
      for_date: "2026-10-04",
      submitted_at: new Date().toISOString(),
      answers: {
        adherence: "Four out of four",
        steps: 8200,
        biggest_struggle: "Thursday evenings",
      },
    });

    const id = await makeCard(client.id);
    const [card] = await loadReviewCards(supabase, [id]);

    expect(card.checkin.length).toBeGreaterThan(0);
    expect(card.checkin[0].isSpine).toBe(true);
    // "steps" is the question that produces step_goal, which is the spine.
    expect(card.checkin[0].key).toBe("steps");
    expect(card.spineVariable).toBe("step_goal");
  });

  it("carries the drafted changes and leaves the applied ones behind", async () => {
    // plan_changes in draft are what Accept All is about. One already applied
    // is history, and showing it would invite the coach to apply it twice.
    const client = await makeClient(supabase);

    await supabase.from("plan_changes").insert([
      {
        client_id: client.id,
        week_number: 4,
        field: "calories",
        from_value: "2650",
        to_value: "2550",
        reason: "Weight is flat over two weeks.",
        source: "ai_draft",
        status: "draft",
      },
      {
        client_id: client.id,
        week_number: 3,
        field: "step_goal",
        from_value: "7000",
        to_value: "8000",
        reason: "Already done.",
        source: "coach",
        status: "applied",
      },
    ]);

    const id = await makeCard(client.id);
    const [card] = await loadReviewCards(supabase, [id]);

    expect(card.changes.map((change) => change.field)).toEqual(["calories"]);
    expect(card.changes[0].from).toBe("2650");
    expect(card.changes[0].decision).toBe("pending");
  });

  it("takes each client's own rows, with several cards in one read", async () => {
    // The queue loads every open card in one call. A join that leaked would
    // put one client's check-in on another client's card, which is the worst
    // thing this screen could do.
    const first = await makeClient(supabase, { first_name: "Alpha" });
    const second = await makeClient(supabase, { first_name: "Beta" });

    await supabase.from("plan_changes").insert({
      client_id: first.id,
      week_number: 4,
      field: "calories",
      from_value: "2650",
      to_value: "2550",
      reason: "Only Alpha's.",
      source: "ai_draft",
      status: "draft",
    });

    const ids = [await makeCard(first.id), await makeCard(second.id)];
    const cards = await loadReviewCards(supabase, ids);

    expect(cards).toHaveLength(2);
    const alpha = cards.find((card) => card.slug === first.slug)!;
    const beta = cards.find((card) => card.slug === second.slug)!;

    expect(alpha.changes).toHaveLength(1);
    expect(beta.changes).toHaveLength(0);
  });

  it("puts a client whose trigger fired this week at the top of the queue", async () => {
    // The flags on a card are the triggers that fired in the last seven days,
    // read out of queue_items rather than out of the frozen detail. A card
    // with one goes to the top whatever the score says.
    const client = await makeClient(supabase);
    await supabase.from("queue_items").insert({
      client_id: client.id,
      kind: "trigger",
      severity: 3,
      title: "Calf above five",
      detail: { key: "calf:test" },
    });

    const id = await makeCard(client.id);
    const [card] = await loadReviewCards(supabase, [id]);

    expect(card.flags.map((flag) => flag.label)).toEqual(["Calf above five"]);
    expect(card.severity).toBe(5);
  });
});

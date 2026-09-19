import type { SupabaseClient } from "@supabase/supabase-js";
import {
  adherenceLines,
  cardSeverity,
  pinSpine,
  type CheckinAnswer,
  type ProposedChange,
  type ReviewCard,
} from "./review-card";
import { resolveQuestions } from "@/lib/checkin/bank";
import type { WeekAdherence } from "@/lib/engine/scoring";

/**
 * Turns the queue's monday_review rows into cards.
 *
 * The score, the focus and the weight line come out of the queue row's detail,
 * which the week roll wrote when it froze the week. The adherence fractions
 * come off program_weeks, because the card shows "3 of 7" and the detail only
 * carries percentages. Neither is recomputed: the snapshot is the record, and
 * a card that recomputed could disagree with it.
 *
 * The proposed changes are plan_changes rows in draft, which is where the
 * weekly review drafter puts them. A card with none is the normal case: nothing
 * flagged and nothing trended means nothing changes.
 */
export async function loadReviewCards(
  supabase: SupabaseClient,
  queueItemIds: string[],
): Promise<ReviewCard[]> {
  if (queueItemIds.length === 0) return [];

  const { data: rows } = await supabase
    .from("queue_items")
    .select("id, client_id, detail, clients(first_name, last_name, slug, primary_goal, program_length_weeks)")
    .in("id", queueItemIds)
    .eq("kind", "monday_review")
    .eq("status", "open");

  const cards: ReviewCard[] = [];

  for (const row of rows ?? []) {
    const detail = (row.detail ?? {}) as {
      weekNumber?: number;
      score?: number;
      focus?: string | null;
      adherence?: Record<string, number | null>;
      weight?: { average: number | null; change: number | null };
      streak?: number;
    };

    const embedded = row.clients as
      | { first_name: string; last_name: string | null; slug: string; primary_goal: string | null; program_length_weeks: number | null }
      | Array<{ first_name: string; last_name: string | null; slug: string; primary_goal: string | null; program_length_weeks: number | null }>
      | null;
    const client = Array.isArray(embedded) ? embedded[0] : embedded;
    if (!client) continue;

    const weekNumber = detail.weekNumber ?? 1;

    const { data: week } = await supabase
      .from("program_weeks")
      .select("adherence, snapshot")
      .eq("client_id", row.client_id)
      .eq("week_number", weekNumber)
      .maybeSingle();

    const adherence = (week?.adherence ?? {}) as WeekAdherence;

    const { data: submission } = await supabase
      .from("checkin_submissions")
      .select("answers, checkin_forms(kind, questions, spine_variable)")
      .eq("client_id", row.client_id)
      .not("submitted_at", "is", null)
      .order("for_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    const form = Array.isArray(submission?.checkin_forms)
      ? submission?.checkin_forms[0]
      : submission?.checkin_forms;

    const spineVariable = (form?.spine_variable ?? null) as string | null;
    // Either shape. The column holds keys from the seed and the week roll and
    // whole objects from older rows written by the Check-ins screen, and this
    // read assumed objects, so a client whose form came from either of the
    // other two writers got a card with an empty check-in.
    const questions = resolveQuestions(form?.questions);
    const answers = (submission?.answers ?? {}) as Record<string, unknown>;

    const checkin: CheckinAnswer[] = questions
      .filter((question) => answers[question.key] !== undefined && answers[question.key] !== null)
      .map((question) => ({
        key: question.key,
        question: question.text,
        answer: String(answers[question.key]),
        isSpine: Boolean(spineVariable && question.produces?.includes(spineVariable)),
      }));

    const { data: drafts } = await supabase
      .from("plan_changes")
      .select("id, field, from_value, to_value, reason")
      .eq("client_id", row.client_id)
      .eq("status", "draft")
      .eq("week_number", weekNumber + 1);

    const changes: ProposedChange[] = (drafts ?? []).map((draft) => ({
      id: draft.id,
      field: draft.field,
      label: draft.field.replace(/_/g, " ").replace(/^./, (first: string) => first.toUpperCase()),
      from: draft.from_value ?? "",
      to: draft.to_value ?? "",
      reason: draft.reason ?? "",
      decision: "pending",
    }));

    const { data: fired } = await supabase
      .from("queue_items")
      .select("title, detail, created_at")
      .eq("client_id", row.client_id)
      .eq("kind", "trigger")
      .gte("created_at", new Date(Date.now() - 7 * 86_400_000).toISOString());

    const score = detail.score ?? 0;
    const weightChange = detail.weight?.change ?? null;

    cards.push({
      clientId: row.client_id,
      slug: client.slug,
      name: [client.first_name, client.last_name].filter(Boolean).join(" "),
      weekNumber,
      weekCount: client.program_length_weeks ?? weekNumber,
      score,
      focus: detail.focus ?? null,
      weight: {
        average: detail.weight?.average ?? null,
        vsLastWeek: weightChange,
        vsPlan: null,
      },
      adherence: adherenceLines(adherence),
      spineVariable,
      checkin: pinSpine(checkin),
      flags: (fired ?? []).map((item, index) => ({
        key: `flag-${index}`,
        label: item.title,
        detail: "",
        date: String(item.created_at).slice(0, 10),
      })),
      changes,
      // Drafted by the weekly review job. Empty until that has run, and the
      // card says so rather than sending a client an empty message.
      message: "",
      severity: cardSeverity({
        score,
        flags: (fired ?? []).length,
        weightChange,
        // Gaining is the goal only for a muscle gain client. The same number is
        // good news for one and bad for the other.
        losingWeight: client.primary_goal !== "muscle_gain",
      }),
    });
  }

  return cards.sort((a, b) => b.severity - a.severity);
}

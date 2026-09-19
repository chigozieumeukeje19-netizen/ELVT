import { notFound, redirect } from "next/navigation";
import { ScreenHeader } from "@/components/ScreenHeader";
import { CompareView, type CompareRow } from "@/components/checkin/CompareView";
import { ReviewThread, type ThreadMessage } from "@/components/checkin/ReviewThread";
import { SubmissionList, type SubmissionRow } from "@/components/checkin/SubmissionList";
import { humanize } from "@/components/Field";
import { currentProfile, isStaff } from "@/lib/auth";
import type { BankQuestion } from "@/lib/checkin/bank";
import { supabaseServer } from "@/lib/supabase/server";
import { regenerateFormsAction, reviewSubmissionAction } from "./actions";

export const dynamic = "force-dynamic";

/**
 * What they said, and what changes because of it.
 *
 * Three things on one screen because they are one job: the list of what has
 * come in, the same question across weeks so a trend is visible, and the thread
 * the coach answers in. A coach who has to open three screens to apply the two
 * week rule will not apply it.
 */
export default async function CheckinsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; submission?: string }>;
}) {
  const profile = await currentProfile();
  if (!profile) redirect("/login");
  if (!isStaff(profile.role)) redirect("/client/today");

  const { slug } = await params;
  const { error, submission: openId } = await searchParams;
  const supabase = await supabaseServer();

  const { data: client } = await supabase
    .from("clients")
    .select("id, first_name, last_name")
    .eq("slug", slug)
    .maybeSingle();
  if (!client) notFound();

  const name = [client.first_name, client.last_name].filter(Boolean).join(" ");

  const { data: forms } = await supabase
    .from("checkin_forms")
    .select("id, kind, questions, spine_variable, schedule")
    .eq("client_id", client.id);

  const { data: submissionRows } = await supabase
    .from("checkin_submissions")
    .select("id, form_id, for_date, answers, submitted_at, reviewed_at, thread_id")
    .eq("client_id", client.id)
    .order("for_date", { ascending: false })
    .limit(60);

  const formById = new Map((forms ?? []).map((form) => [form.id, form]));
  const submissions = submissionRows ?? [];

  const rows: SubmissionRow[] = submissions.map((row) => {
    const form = formById.get(row.form_id);
    const answers = (row.answers ?? {}) as Record<string, unknown>;
    // The one answer that says what kind of week it was.
    const headline =
      typeof answers.biggest_struggle === "string" && answers.biggest_struggle
        ? answers.biggest_struggle
        : typeof answers.the_one_thing === "string" && answers.the_one_thing
          ? answers.the_one_thing
          : row.submitted_at
            ? "Submitted"
            : "Waiting on them";

    return {
      id: row.id,
      kind: (form?.kind ?? "daily") as SubmissionRow["kind"],
      forDate: row.for_date,
      submittedAt: row.submitted_at,
      reviewedAt: row.reviewed_at,
      headline,
      replies: 0,
    };
  });

  const weeklyForm = (forms ?? []).find((form) => form.kind === "weekly" || form.kind === "week1");
  const weeklyQuestions = ((weeklyForm?.questions ?? []) as BankQuestion[]).filter(
    (question) => question.type === "scale" || question.type === "metric" || question.type === "number",
  );

  const weeklySubmissions = submissions
    .filter((row) => formById.get(row.form_id)?.kind !== "daily" && row.submitted_at)
    .sort((a, b) => (a.for_date < b.for_date ? -1 : 1));

  const weeks = weeklySubmissions.map((_, index) => index + 1);

  const compareRows: CompareRow[] = weeklyQuestions.map((question) => ({
    questionKey: question.key,
    text: question.text,
    values: weeklySubmissions.map((row, index) => {
      const answers = (row.answers ?? {}) as Record<string, unknown>;
      const value = answers[question.key];
      return {
        week: index + 1,
        value:
          typeof value === "number" || typeof value === "string" ? value : null,
      };
    }),
  }));

  const open = submissions.find((row) => row.id === openId) ?? submissions[0];

  let thread: ThreadMessage[] = [];
  if (open?.thread_id) {
    const { data: messages } = await supabase
      .from("messages")
      .select("id, sender_id, body, sent_at, created_at")
      .eq("thread_id", open.thread_id)
      .order("created_at");

    thread = (messages ?? []).map((message) => ({
      id: message.id,
      from: message.sender_id === profile.id ? "coach" : "client",
      body: message.body ?? "",
      at: (message.sent_at ?? message.created_at).slice(0, 10),
    }));
  }

  return (
    <main className="px-5 py-4">
      <ScreenHeader
        label="Check-ins"
        title={name}
        note={
          weeklyForm?.spine_variable
            ? `This week's form is built around ${humanize(weeklyForm.spine_variable)}, which is what changed last Monday`
            : "Nothing changed last Monday, so this week's form is built from their goal and flags"
        }
        error={error}
        actions={
          <form action={regenerateFormsAction}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="weekNumber" value={weeks.length + 1} />
            <button className="elvt-button-secondary" type="submit">
              Rebuild the forms
            </button>
          </form>
        }
      />

      <section>
        <h2 className="elvt-label">Submissions</h2>
        <div className="mt-2">
          <SubmissionList rows={rows} />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="elvt-label">The same question, week by week</h2>
        <p className="mt-1 text-txt-dim">
          One bad week is noise. Two is a signal. This is where that shows.
        </p>
        <div className="mt-2">
          <CompareView rows={compareRows} weeks={weeks} />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="elvt-label">
          {open ? `Review, ${open.for_date}` : "Review"}
        </h2>
        <div className="mt-2 max-w-[70ch]">
          <ReviewThread
            messages={thread}
            action={reviewSubmissionAction}
            slug={slug}
            submissionId={open?.id}
          />
        </div>
      </section>
    </main>
  );
}

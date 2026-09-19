import type { ExplainedDecision } from "@/lib/blueprint/program-draft";

/**
 * Every decision the applier made, in sentences.
 *
 * A coach approving a program for a client with a spinal fusion has to be able
 * to read why the back squat is not in it. "substitution squat injury" is a log
 * line; this is the screen that turns it into something arguable.
 *
 * Identical decisions repeat once per week in a long block, so they are
 * collapsed with a count rather than listed sixteen times.
 */
export function DecisionList({ decisions }: { decisions: ExplainedDecision[] }) {
  if (decisions.length === 0) {
    return (
      <p className="text-txt-mute" data-testid="decisions-empty">
        The template applied with nothing changed. No substitutions, no dropped
        slots, no days moved.
      </p>
    );
  }

  const collapsed = new Map<string, { decision: ExplainedDecision; count: number }>();
  for (const decision of decisions) {
    const existing = collapsed.get(decision.explanation);
    if (existing) existing.count += 1;
    else collapsed.set(decision.explanation, { decision, count: 1 });
  }

  return (
    <ul data-testid="decision-list">
      {[...collapsed.values()].map(({ decision, count }) => (
        <li
          key={decision.explanation}
          data-testid="decision"
          className="flex items-start gap-3 border-line py-2 [border-bottom-width:1px]"
        >
          <span
            aria-hidden="true"
            className={[
              "mt-2 h-1 w-1 shrink-0",
              decision.kind === "slot_dropped" || decision.kind === "session_dropped"
                ? "bg-flag"
                : "bg-watch",
            ].join(" ")}
          />
          <span className="min-w-0 flex-1">{decision.explanation}</span>
          {count > 1 ? (
            <span className="elvt-label shrink-0 text-txt-dim">
              {count} weeks
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

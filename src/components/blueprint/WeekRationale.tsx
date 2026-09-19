/**
 * One line per week saying what the week is for.
 *
 * The only part of a drafted program that is judgement rather than arithmetic,
 * so the only part that goes through the prompt and paste flow. Empty until
 * something is pasted, and the screen says so rather than showing twelve blank
 * rows.
 */
export function WeekRationale({
  rationale,
  weekCount,
}: {
  rationale: { week: number; rationale: string }[];
  weekCount: number;
}) {
  if (rationale.length === 0) {
    return (
      <p className="text-txt-mute" data-testid="rationale-empty">
        No rationale yet. Copy the prompt, paste the answer back, and a line per
        week lands here for you to edit before the program is published.
      </p>
    );
  }

  return (
    <ol data-testid="week-rationale">
      {Array.from({ length: weekCount }, (_, i) => i + 1).map((week) => {
        const entry = rationale.find((row) => row.week === week);
        return (
          <li
            key={week}
            data-testid="rationale-row"
            className="flex items-start gap-3 border-line py-2 [border-bottom-width:1px]"
          >
            <span className="elvt-num w-[3ch] shrink-0 text-txt-dim">{week}</span>
            <span className="min-w-0 flex-1">
              {entry?.rationale ?? (
                <span className="text-txt-dim">Nothing written for this week.</span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

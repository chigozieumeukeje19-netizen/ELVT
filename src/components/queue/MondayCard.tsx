import { humanize } from "@/components/Field";
import { adherence as adherenceFigure, figureClass } from "@/lib/design/semantic";
import type { ReviewCard } from "@/lib/queue/review-card";

/**
 * One client's Monday, in the order it gets read.
 *
 * The target is two minutes a client and fifteen for eight of them, and that
 * target is what decided the layout: the score at 56px because it is the one
 * number that says what kind of week it was, then the fractions, then what they
 * said with the spine pinned, then the diff, then the message. Nothing here
 * requires scrolling back up, and nothing requires opening another screen.
 *
 * The diff is the working part. Each line is accept, edit or reject on its own,
 * because a coach who has to take all three or none will take all three.
 */
/**
 * How many check-in answers the card carries.
 *
 * A weekly form is about fifteen questions and all fifteen do not belong here.
 * The card carries the spine answer, which says whether last Monday's change
 * worked, and the two after it, and points at the check-ins tab for the rest.
 *
 * This is a density decision, not a preference: with the whole check-in on it
 * the card ran 988px against a 900px viewport, so nothing after it was visible
 * without scrolling and DESIGN.md's rule about seeing the top edge of the next
 * card was broken.
 */
const ANSWERS_ON_CARD = 3;

export function MondayCard({
  card,
  action,
  readOnly,
}: {
  card: ReviewCard;
  action?: (formData: FormData) => void;
  readOnly?: boolean;
}) {
  const decided = card.changes.filter((change) => change.decision !== "pending").length;
  const shownAnswers = card.checkin.slice(0, ANSWERS_ON_CARD);
  const hiddenAnswers = card.checkin.length - shownAnswers.length;

  return (
    <article
      className="elvt-panel-raised rounded-raised p-3"
      data-testid="monday-card"
      data-severity={card.severity}
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="elvt-label">
            Week {card.weekNumber} of {card.weekCount}
          </p>
          <h2 className="mt-1 truncate text-name">{card.name}</h2>
        </div>

        <div className="text-right">
          <p className="elvt-label">ELVT score</p>
          <p className="elvt-num text-hero" data-testid="card-score">
            {Math.round(card.score)}
          </p>
          {/*
            The weakest category, in words and without color. It used to be
            amber, which spent a signal on a label and said the same thing
            twice: the fraction for that category is already banded two inches
            away. Color marks a figure with a threshold, never prose.
          */}
          {card.focus ? (
            <p className="text-small text-txt-secondary" data-testid="card-focus">
              {humanize(card.focus)} is the weak one
            </p>
          ) : null}
        </div>
      </header>

      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <section className="min-w-0">
          <h3 className="elvt-label">Weight</h3>
          <dl className="mt-1 flex flex-wrap gap-5" data-testid="card-weight">
            <Figure label="7 day average" value={card.weight.average} />
            <Figure label="vs last week" value={card.weight.vsLastWeek} signed />
            <Figure label="vs plan" value={card.weight.vsPlan} signed />
          </dl>

          <h3 className="elvt-label mt-3">Adherence</h3>
          {/*
            Five figures across rather than five stacked rows. Stacked at the
            44px row height they were 220px on their own and set the whole
            card's height, which pushed it past the fold. Side by side is also
            how a timing screen reads a set of related fractions: the labels are
            small, the numbers line up, and the eye takes all five at once.
          */}
          <ul className="mt-1 flex flex-wrap gap-5" data-testid="card-adherence">
            {card.adherence.map((line) => (
              <li key={line.key} data-testid="adherence-line" className="min-w-[8ch]">
                <p className="elvt-label truncate">{line.label}</p>
                <p
                  className={`elvt-num text-emphasis ${figureClass(adherenceFigure(line.done, line.planned).state)}`}
                  title={adherenceFigure(line.done, line.planned).label}
                >
                  {line.planned === 0 ? (
                    <span className="text-txt-dim">none planned</span>
                  ) : (
                    `${line.done}/${line.planned}`
                  )}
                </p>
                {line.percent === null ? null : (
                  <p className="elvt-num text-txt-dim">{line.percent}%</p>
                )}
              </li>
            ))}
          </ul>

          {card.flags.length > 0 ? (
            <>
              <h3 className="elvt-label mt-3">Flags this week</h3>
              <ul className="mt-1" data-testid="card-flags">
                {card.flags.map((flag) => (
                  <li key={flag.key} className="flex gap-3 py-1">
                    <span className="elvt-num shrink-0 text-txt-dim">{flag.date}</span>
                    <span className="min-w-0 flex-1">
                      <span className="text-flag">{flag.label}</span>{" "}
                      <span className="text-txt-mute">{flag.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>

        <section className="min-w-0">
          <h3 className="elvt-label">
            What they said
            {card.spineVariable ? (
              <span className="ml-2 text-txt-dim">
                {humanize(card.spineVariable)} changed last Monday
              </span>
            ) : null}
          </h3>

          <ul className="mt-1" data-testid="card-checkin">
            {shownAnswers.map((answer) => (
              <li
                key={answer.key}
                data-testid="checkin-answer"
                data-spine={answer.isSpine ? "true" : undefined}
                className="border-line py-2 [border-bottom-width:1px]"
              >
                <p className="elvt-label">
                  {answer.question}
                  {answer.isSpine ? (
                    // Weight, not color. This marks which question to read
                    // first; it is not a state anybody acts on.
                    <span className="ml-2 font-semibold text-txt">The one that matters</span>
                  ) : null}
                </p>
                <p className="mt-1 max-w-[60ch]">{answer.answer}</p>
              </li>
            ))}
          </ul>

          {hiddenAnswers > 0 ? (
            <a
              className="elvt-label mt-2 inline-block text-txt-mute"
              href={`/coach/clients/${card.slug}/checkins`}
              data-testid="more-answers"
            >
              {hiddenAnswers} more on the check-ins tab
            </a>
          ) : null}
        </section>
      </div>

      <section className="mt-4">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="elvt-label">What I would change</h3>
          <span className="elvt-num text-txt-dim">
            {decided} of {card.changes.length} decided
          </span>
        </div>

        {card.changes.length === 0 ? (
          <p className="mt-2 text-txt-mute" data-testid="no-changes">
            Nothing to change. No flag fired and nothing has pointed the same way
            two weeks running, so the week stands.
          </p>
        ) : (
          <ul className="mt-2" data-testid="card-changes">
            {card.changes.map((change) => (
              <li
                key={change.id}
                data-testid="change-line"
                data-decision={change.decision}
                className="border-line py-2 [border-bottom-width:1px]"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <span className="min-w-0">
                    <span className="elvt-label">{change.label}</span>{" "}
                    <span className="elvt-num text-txt-mute">{change.from}</span>
                    <span className="elvt-num mx-2 text-txt-dim">to</span>
                    <span className="elvt-num">
                      {change.decision === "edit" ? (change.editedTo ?? change.to) : change.to}
                    </span>
                  </span>

                  {!readOnly ? (
                    <span className="flex shrink-0 gap-1">
                      {(["accept", "edit", "reject"] as const).map((decision) => (
                        <button
                          key={decision}
                          type="button"
                          name="decision"
                          value={`${change.id}:${decision}`}
                          aria-pressed={change.decision === decision}
                          data-testid={`decide-${decision}`}
                          className={[
                            "elvt-chip",
                            change.decision === decision ? "bg-panel-2 text-txt" : "text-txt-mute",
                          ].join(" ")}
                        >
                          {humanize(decision)}
                        </button>
                      ))}
                    </span>
                  ) : (
                    <span className="elvt-label shrink-0 text-txt-dim">
                      {humanize(change.decision)}
                    </span>
                  )}
                </div>

                <p className="mt-1 max-w-[70ch] text-txt-mute">{change.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-4">
        <h3 className="elvt-label">The message</h3>
        <p
          className="mt-1 max-w-[68ch] whitespace-pre-line bg-panel-2 px-3 py-2"
          data-testid="card-message"
        >
          {card.message}
        </p>
      </section>

      {!readOnly && action ? (
        <form action={action} className="mt-4 flex gap-2">
          <input type="hidden" name="cardId" value={card.clientId} />
          <input type="hidden" name="weekNumber" value={card.weekNumber} />
          <button className="elvt-button" type="submit" data-testid="accept-all">
            Accept all, publish and send
          </button>
          <button className="elvt-button-secondary" type="submit" name="intent" value="skip">
            Nothing this week
          </button>
        </form>
      ) : null}
    </article>
  );
}

function Figure({
  label,
  value,
  signed,
}: {
  label: string;
  value: number | null;
  signed?: boolean;
}) {
  return (
    <div>
      <dt className="elvt-label">{label}</dt>
      <dd className="elvt-num text-section">
        {value === null ? (
          <span className="text-txt-dim">no data</span>
        ) : signed && value > 0 ? (
          `+${value}`
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

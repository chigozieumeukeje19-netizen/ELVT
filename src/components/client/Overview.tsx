import Link from "next/link";
import { humanize } from "@/components/Field";
import { bandLabel, bandTextClass, bandFor } from "@/lib/design/bands";
import {
  UPCOMING_LABELS,
  type ActiveFlag,
  type CheckinSummary,
  type ProgramPosition,
  type TouchpointLine,
  type UpcomingEvent,
} from "@/lib/client/overview";
import type { AdherenceLine } from "@/lib/queue/review-card";

/**
 * The Overview.
 *
 * One number at 56px, per DESIGN.md Part 2, and it is the ELVT score: it is
 * the only figure that answers "how is this week going" on its own, and
 * everything else is read after it.
 *
 * Deliberately not six equal tiles across the top. That is hard fail 9, and
 * the six numbers are not equals: five of them are fractions of a plan and one
 * is the summary of all five. Hierarchy comes from size and position, so the
 * score is the hero and the rest are 44px rows in a dense stack, which is the
 * Instrument Panel idiom anyway.
 */

const NO_DATA = "·";

export type OverviewTile = {
  key: string;
  label: string;
  value: string;
  /** Read beside the value, never instead of it. */
  note: string | null;
  band: "ok" | "watch" | "flag" | null;
};

/** The weight row, which is not an adherence fraction and bands differently. */
export function weightTile(
  latest: number | null,
  vsLastWeek: number | null,
  units: string,
): OverviewTile {
  return {
    key: "weight",
    label: "Weight",
    value: latest === null ? NO_DATA : `${latest.toFixed(1)}`,
    note:
      latest === null
        ? "Nothing logged"
        : vsLastWeek === null
          ? units === "metric" ? "kg" : "lb"
          : `${vsLastWeek > 0 ? "up" : vsLastWeek < 0 ? "down" : "level"} ${Math.abs(vsLastWeek).toFixed(1)} on last week`,
    // Direction is not good or bad without knowing the goal, so this row is
    // neutral. The Progress tab is where the trend is read.
    band: null,
  };
}

export function tilesFrom(adherence: AdherenceLine[], weight: OverviewTile): OverviewTile[] {
  return [
    weight,
    ...adherence.map((line) => ({
      key: line.key,
      label: line.label,
      value: line.planned === 0 ? NO_DATA : `${line.done} of ${line.planned}`,
      note: line.planned === 0 ? "Nothing planned" : line.percent === null ? null : `${Math.round(line.percent)}%`,
      band: line.band,
    })),
  ];
}

export function ScoreAndTiles({
  score,
  focus,
  tiles,
}: {
  score: number | null;
  focus: string | null;
  tiles: OverviewTile[];
}) {
  const band = bandFor(score);

  return (
    <section className="mb-5" data-testid="overview-numbers">
      <div className="flex items-baseline gap-3">
        <p
          className={`elvt-num text-hero ${bandTextClass(band)}`}
          data-testid="elvt-score"
          data-band={band ?? "none"}
          title={bandLabel(band)}
        >
          {score === null ? NO_DATA : Math.round(score)}
        </p>
        <div>
          <p className="elvt-label">ELVT score</p>
          <p className="text-txt-mute">
            {score === null
              ? "No week closed yet"
              : focus
                ? `${bandLabel(band)}. ${humanize(focus)} is the weakest part.`
                : bandLabel(band)}
          </p>
        </div>
      </div>

      <div className="mt-3">
        {tiles.map((tile) => (
          <div
            key={tile.key}
            data-testid="overview-tile"
            data-tile={tile.key}
            data-band={tile.band ?? "none"}
            className="flex min-h-[44px] items-baseline justify-between gap-4 py-2"
          >
            <span className="elvt-label shrink-0">{tile.label}</span>
            <span className="min-w-0 text-right">
              <span className={`elvt-num ${tile.band ? bandTextClass(tile.band) : "text-txt"}`}>
                {tile.value}
              </span>
              {tile.note ? <span className="ml-2 text-txt-mute">{tile.note}</span> : null}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function TopStrip({
  name,
  age,
  sex,
  goalStatement,
  programName,
  position,
  phase,
  raceLine,
  startDate,
}: {
  name: string;
  age: number | null;
  sex: string | null;
  goalStatement: string | null;
  programName: string | null;
  position: ProgramPosition | null;
  phase: string | null;
  raceLine: string | null;
  startDate: string | null;
}) {
  const facts = [
    age === null ? null : `${age}`,
    sex ? humanize(sex) : null,
    programName,
    position
      ? position.state === "before"
        ? `Starts ${startDate}`
        : position.state === "finished"
          ? `Finished ${position.endsOn}`
          : `Day ${position.day} of ${position.totalDays}`
      : null,
  ].filter(Boolean) as string[];

  return (
    <header className="mb-4" data-testid="top-strip">
      <h1 className="text-name" data-testid="client-name">
        {name}
      </h1>

      <p className="mt-1 text-txt-mute" data-testid="client-facts">
        {facts.join(" · ")}
      </p>

      {goalStatement ? (
        <p className="mt-2 max-w-[68ch] text-txt" data-testid="goal-statement">
          {goalStatement}
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {phase ? (
          <span className="elvt-chip bg-panel-2 text-txt" data-testid="phase-chip">
            {phase}
          </span>
        ) : null}
        {position ? (
          <span className="text-txt-mute" data-testid="block-dates">
            {startDate} to {position.endsOn}
          </span>
        ) : null}
        {raceLine ? (
          <span className="elvt-chip text-txt-mute" data-testid="race-line">
            {raceLine}
          </span>
        ) : null}
      </div>
    </header>
  );
}

export function OneThing({ text }: { text: string | null }) {
  return (
    <section className="elvt-panel mb-5 px-4 py-4" data-testid="one-thing">
      <p className="elvt-label">The one thing</p>
      {text ? (
        <p className="mt-2 max-w-[60ch] text-txt">{text}</p>
      ) : (
        <p className="mt-2 max-w-[60ch] text-txt-mute">
          The intake asks them what they know they should be doing and are not,
          and their answer lands here when the Blueprint is approved. Until then
          it is blank, and it is the one line worth writing by hand on the
          Blueprint tab before the first message goes out.
        </p>
      )}
    </section>
  );
}

export function Flags({ flags }: { flags: ActiveFlag[] }) {
  return (
    <section className="mb-5" data-testid="flags">
      <p className="elvt-label">Active flags</p>
      {flags.length === 0 ? (
        <p className="mt-2 max-w-[60ch] text-txt-mute">
          None on file. Flags come from the intake and shape the program; they
          are not an open item to clear.
        </p>
      ) : (
        <ul className="mt-2">
          {flags.map((flag) => (
            <li
              key={flag.key}
              data-testid="flag"
              className="flex min-h-[44px] items-baseline justify-between gap-4 py-2"
            >
              <span className="text-txt">{humanize(flag.key)}</span>
              <span className="elvt-num text-txt-mute">{flag.since ?? "On file"}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function LastCheckin({ summary, slug }: { summary: CheckinSummary | null; slug: string }) {
  return (
    <section className="mb-5" data-testid="last-checkin">
      <div className="flex items-baseline justify-between gap-4">
        <p className="elvt-label">Last check-in</p>
        <Link href={`/coach/clients/${slug}/checkins`} className="text-txt-mute">
          All of them
        </Link>
      </div>

      {summary === null ? (
        <p className="mt-2 max-w-[60ch] text-txt-mute">
          Nothing submitted yet. The weekly lands on their check-in day and shows
          up here the moment it is sent.
        </p>
      ) : (
        <>
          <p className="mt-2 text-txt-mute">
            {summary.forDate}, {summary.daysAgo === 0 ? "today" : `${summary.daysAgo}d ago`}
            {summary.reviewed ? ", reviewed" : ", not reviewed yet"}
          </p>
          <ul className="mt-2">
            {summary.lines.map((line) => (
              <li key={line.question} className="min-h-[44px] py-2" data-testid="checkin-line">
                <p className="elvt-label">{line.question}</p>
                <p className="text-txt">{line.answer}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export function Touchpoints({ lines }: { lines: TouchpointLine[] }) {
  return (
    <section className="mb-5" data-testid="touchpoints">
      <p className="elvt-label">Last five touchpoints</p>
      {lines.length === 0 ? (
        <p className="mt-2 max-w-[60ch] text-txt-mute">
          Nothing has reached them yet. A message, a check-in review or a call
          all count, and two a week is the number that moves compliance.
        </p>
      ) : (
        <ul className="mt-2">
          {lines.map((line) => (
            <li
              key={line.at}
              data-testid="touchpoint"
              className="flex min-h-[44px] items-baseline justify-between gap-4 py-2"
            >
              <span className="text-txt">{humanize(line.kind)}</span>
              <span className="elvt-num text-txt-mute">
                {line.daysAgo === 0 ? "Today" : `${line.daysAgo}d ago`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function Upcoming({ events }: { events: UpcomingEvent[] }) {
  return (
    <section className="mb-5" data-testid="upcoming">
      <p className="elvt-label">Upcoming</p>
      {events.length === 0 ? (
        <p className="mt-2 max-w-[60ch] text-txt-mute">
          Nothing in the next six weeks. Photos, a race, a phase change or a
          retest all show up here as they come into range.
        </p>
      ) : (
        <ul className="mt-2">
          {events.map((event) => (
            <li
              key={`${event.kind}-${event.date}`}
              data-testid="upcoming-event"
              data-kind={event.kind}
              className="flex min-h-[44px] items-baseline justify-between gap-4 py-2"
            >
              <span className="min-w-0">
                <span className="text-txt">{UPCOMING_LABELS[event.kind]}</span>
                <span className="ml-2 text-txt-mute">{event.detail}</span>
              </span>
              <span className="elvt-num shrink-0 text-txt-mute">
                {event.inDays === 0 ? "Today" : `${event.inDays}d`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function CoachNotes({
  notes,
  action,
}: {
  notes: string | null;
  action: (formData: FormData) => void;
}) {
  return (
    <section className="elvt-panel mb-5 px-4 py-4" data-testid="coach-notes">
      <p className="elvt-label">Coach notes</p>
      <p className="mt-1 text-txt-mute">Private. The client never sees this.</p>

      <form action={action} className="mt-2">
        <textarea
          name="notes"
          rows={4}
          defaultValue={notes ?? ""}
          placeholder="What you would want to remember before the next call."
          className="elvt-input"
          data-testid="coach-notes-input"
        />
        <button type="submit" className="elvt-button mt-2">
          Save
        </button>
      </form>
    </section>
  );
}

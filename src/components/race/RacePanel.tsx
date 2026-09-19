import { bandTextClass, bandLabel } from "@/lib/design/bands";
import {
  checklistFor,
  distanceName,
  formatDuration,
  formatPace,
  fuelingPlan,
  mileageBand,
  PHASE_LABELS,
  racePace,
  raceStatus,
  type Race,
  type RaceStatus,
  type WeekMileage,
} from "@/lib/race/mode";

/**
 * Race mode, coach side.
 *
 * The countdown is the one number the screen is about, so it is the only thing
 * at hero size and everything else is read after it. It counts from the day
 * being viewed rather than from today, which is the whole reason the module
 * under it takes a date.
 */

const NO_DATA = "·";

/** A label and a value on one line, which is most of this screen. */
function Line({
  label,
  value,
  note,
  className = "",
}: {
  label: string;
  value: string;
  note?: string;
  className?: string;
}) {
  return (
    <div className="flex min-h-[44px] items-baseline justify-between gap-4 py-2">
      <span className="elvt-label shrink-0">{label}</span>
      <span className="min-w-0 text-right">
        <span className={`elvt-num ${className || "text-txt"}`}>{value}</span>
        {note ? <span className="ml-2 text-txt-secondary">{note}</span> : null}
      </span>
    </div>
  );
}

export function RaceCountdown({
  race,
  viewedDate,
  status,
}: {
  race: Race;
  viewedDate: string;
  status: RaceStatus;
}) {
  const past = status.daysOut < 0;

  return (
    <section data-testid="race-countdown">
      <div className="flex items-baseline gap-3">
        <p className="elvt-num text-display" data-testid="race-days-out" data-days-out={status.daysOut}>
          {Math.abs(status.daysOut)}
        </p>
        <div className="min-w-0">
          <p className="elvt-label">{race.name}</p>
          <p className="text-txt-secondary">
            {past ? "days since" : status.daysOut === 0 ? "it is today" : "days out"}, read on{" "}
            {viewedDate}
          </p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="elvt-chip bg-raised text-txt" data-testid="race-phase" data-phase={status.phase}>
          {PHASE_LABELS[status.phase]}
        </span>
        <span className="text-txt-secondary">
          {status.weeksRemaining === 0
            ? past
              ? "Run."
              : "Race day."
            : status.weeksRemaining === 1
              ? "One week left."
              : `${status.weeksRemaining} weeks left.`}
        </span>
      </div>
    </section>
  );
}

export function RaceDetails({
  race,
  status,
  weeklyMiles,
  longest,
}: {
  race: Race;
  status: RaceStatus;
  weeklyMiles: number;
  longest: { distance: number; date: string } | null;
}) {
  const pace = racePace(race);

  return (
    <section className="elvt-card px-4 py-2" data-testid="race-details">
      <Line label="Distance" value={distanceName(race.metres)} />
      <Line label="Date" value={race.date} />
      <Line
        label="Goal"
        value={race.goalTimeSeconds === null ? "Finish it" : formatDuration(race.goalTimeSeconds)}
        note={race.goalTimeSeconds === null ? "No time on it" : undefined}
      />
      <Line
        label="Race pace"
        value={pace ? `${formatPace(pace.secondsPerMile)}` : NO_DATA}
        note={pace ? `a mile, ${formatPace(pace.secondsPerKm)} a kilometre` : "Set a goal time"}
      />
      <Line
        label="Taper starts"
        value={status.taperStartsOn}
        note={
          status.daysToTaper === null
            ? "already in it"
            : status.daysToTaper === 1
              ? "tomorrow"
              : `in ${status.daysToTaper} days`
        }
      />
      <Line label="This week" value={`${weeklyMiles}`} note="miles in the last seven days" />
      <Line
        label="Longest run"
        value={longest ? `${longest.distance}` : NO_DATA}
        note={longest ? `miles, ${longest.date}` : "Nothing logged yet"}
      />
    </section>
  );
}

export function FuelingPlanCard({
  race,
  recentSecondsPerMile,
}: {
  race: Race;
  recentSecondsPerMile: number | null;
}) {
  const plan = fuelingPlan(race, recentSecondsPerMile);

  if (!plan) {
    return (
      <section className="elvt-card px-4 py-4" data-testid="fueling">
        <p className="elvt-label">Fueling</p>
        <p className="mt-2 max-w-[60ch] text-txt-secondary">
          A fueling plan is built from how long the race will take, and there is
          nothing here to work that out from yet. Put a goal time on the race,
          or log a run, and this fills in.
        </p>
      </section>
    );
  }

  return (
    <section className="elvt-card px-4 py-2" data-testid="fueling">
      <div className="py-2">
        <p className="elvt-label">Fueling</p>
        <p className="mt-1 text-txt-secondary">
          Built on {formatDuration(plan.estimatedSeconds)},{" "}
          {plan.source === "goal_time" ? "the goal time" : "their recent pace"}.
        </p>
      </div>

      {plan.gels === 0 ? (
        <p className="max-w-[60ch] pb-3 text-txt">{plan.note}</p>
      ) : (
        <>
          <Line
            label="Carbohydrate"
            value={`${plan.carbsPerHourMin} to ${plan.carbsPerHourMax}`}
            note="grams an hour"
          />
          <Line label="Fluid" value={`${plan.fluidMlPerHourMin} to ${plan.fluidMlPerHourMax}`} note="ml an hour" />
          <Line label="Gels" value={`${plan.gels}`} note="to carry, at 25g each" />
          <Line
            label="First one at"
            value={`${plan.firstFuelMinutes}`}
            note={`minutes, then every ${plan.everyMinutes}`}
          />
          <p className="max-w-[60ch] py-2 text-txt-secondary">{plan.note}</p>
        </>
      )}
    </section>
  );
}

export function RaceWeekChecklist({ race, viewedDate }: { race: Race; viewedDate: string }) {
  const lines = checklistFor(race, viewedDate);

  return (
    <section data-testid="race-checklist">
      <p className="elvt-label">Race week</p>
      <ul className="mt-2">
        {lines.map((line) => (
          <li
            key={line.key}
            data-testid="checklist-line"
            data-today={line.isToday ? "true" : undefined}
            className={`flex min-h-[44px] items-baseline gap-3 py-2 ${
              line.isPast ? "text-txt-tertiary" : line.isToday ? "text-txt" : "text-txt-secondary"
            }`}
          >
            <span className="elvt-num w-[92px] shrink-0">{line.date}</span>
            <span className="min-w-0">{line.text}</span>
            {line.isToday ? <span className="elvt-label shrink-0">Today</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function MileageTable({ rows }: { rows: WeekMileage[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-txt-secondary" data-testid="mileage-empty">
        No weeks planned yet. Planned against completed shows up once the
        program is built.
      </p>
    );
  }

  return (
    <section data-testid="mileage">
      <p className="elvt-label">Planned against completed</p>
      <div className="mt-2 overflow-x-auto">
        <table className="elvt-table">
          <thead>
            <tr>
              <th scope="col" className="w-[80px]">Week</th>
              <th scope="col" className="w-[110px]">Starts</th>
              <th scope="col" className="w-[90px]">Planned</th>
              <th scope="col" className="w-[90px]">Run</th>
              <th scope="col" className="w-[110px]">Of plan</th>
              <th scope="col" className="w-[120px]">Phase</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const band = mileageBand(row);
              return (
                <tr key={row.weekNumber} data-testid="mileage-row" data-week={row.weekNumber}>
                  <td className="elvt-num text-txt">{row.weekNumber}</td>
                  <td className="elvt-num text-txt-secondary">{row.startsOn}</td>
                  <td className="elvt-num text-txt-secondary">
                    {row.planned === null ? NO_DATA : row.planned}
                  </td>
                  <td className="elvt-num text-txt">{row.completed}</td>
                  <td
                    className={`elvt-num ${bandTextClass(band)}`}
                    title={band ? bandLabel(band) : "Not banded during the taper"}
                    data-band={band ?? "none"}
                  >
                    {row.percent === null ? NO_DATA : `${Math.round(row.percent)}%`}
                  </td>
                  <td className="text-txt-secondary">
                    {row.isRaceWeek ? "Race week" : row.isTaper ? "Taper" : NO_DATA}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * Everything, in the order a coach reads it: how long there is, what the race
 * is, what to eat, what to do this week, and whether the mileage happened.
 *
 * The checklist only appears once it is race week. Nine lines about pinning a
 * number are noise in week four of eighteen, and a panel that is always there
 * is a panel nobody reads when it finally matters.
 */
export function RacePanel({
  race,
  viewedDate,
  weeklyMiles,
  longest,
  recentSecondsPerMile,
  mileage,
}: {
  race: Race;
  viewedDate: string;
  weeklyMiles: number;
  longest: { distance: number; date: string } | null;
  recentSecondsPerMile: number | null;
  mileage: WeekMileage[];
}) {
  const status = raceStatus(race, viewedDate);

  return (
    <div className="flex flex-col gap-5">
      <RaceCountdown race={race} viewedDate={viewedDate} status={status} />
      <RaceDetails race={race} status={status} weeklyMiles={weeklyMiles} longest={longest} />
      <FuelingPlanCard race={race} recentSecondsPerMile={recentSecondsPerMile} />
      {status.phase === "race_week" || status.phase === "race_day" ? (
        <RaceWeekChecklist race={race} viewedDate={viewedDate} />
      ) : null}
      <MileageTable rows={mileage} />
    </div>
  );
}

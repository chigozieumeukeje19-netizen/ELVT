import type { MaterializedProgram, MaterializedWeek } from "./apply-template";
import { dayStress, stressFlags, weekMileage, weekStress, type StressFlag } from "./stress";
import type { PhaseBand } from "./types";

/**
 * The shape the program tab renders.
 *
 * Built once from a materialized program so the screen never recomputes stress
 * while drawing, and so the same view model serves both a program read from the
 * database and one produced by the applier for a preview.
 */

export type DayView = {
  date: string;
  dayOfWeek: number;
  isRest: boolean;
  stress: number;
  sessions: {
    key: string;
    name: string;
    kind: string;
    stimulus: string;
    /** One line the coach reads without opening the session. */
    summary: string;
  }[];
};

export type WeekView = {
  weekNumber: number;
  startsOn: string;
  isDeload: boolean;
  phase: string | null;
  stress: number;
  mileage: number;
  days: DayView[];
  flags: StressFlag[];
};

export type ProgramView = {
  weeks: WeekView[];
  phases: PhaseBand[];
  /** Highest day stress in the block, so the rail can scale against something. */
  peakDayStress: number;
};

function phaseFor(phases: PhaseBand[], weekNumber: number): string | null {
  const band = phases.find(
    (p) => weekNumber >= p.startWeek && weekNumber <= p.endWeek,
  );
  return band?.name ?? null;
}

function summarize(session: MaterializedWeek["days"][number]["sessions"][number]): string {
  if (session.run) {
    const distance = session.run.distanceTarget;
    return distance ? `${distance} miles` : "Run";
  }
  const sets = session.exercises.reduce((n, e) => n + e.sets.length, 0);
  if (session.exercises.length === 0) return "No movements yet";
  // Volume is what the coach scans for on a card. The movement list is one
  // click away, and the longer phrase does not fit the column.
  return `${sets} sets`;
}

export function buildProgramView(
  program: MaterializedProgram,
  phases: PhaseBand[],
): ProgramView {
  const flags = stressFlags(program.weeks);

  const weeks: WeekView[] = program.weeks.map((week) => ({
    weekNumber: week.weekNumber,
    startsOn: week.startsOn,
    isDeload: week.isDeload,
    phase: phaseFor(phases, week.weekNumber),
    stress: weekStress(week),
    mileage: weekMileage(week),
    flags: flags.filter((f) => f.weekNumber === week.weekNumber),
    days: week.days.map((day) => ({
      date: day.date,
      dayOfWeek: day.dayOfWeek,
      isRest: day.isRest,
      stress: dayStress(day),
      sessions: day.sessions.map((session) => ({
        key: session.key,
        name: session.name,
        kind: session.kind,
        stimulus: session.stimulus,
        summary: summarize(session),
      })),
    })),
  }));

  const peakDayStress = Math.max(
    1,
    ...weeks.flatMap((w) => w.days.map((d) => d.stress)),
  );

  return { weeks, phases, peakDayStress };
}

/**
 * The periodization grid: one movement per row, one column per week, so a whole
 * block of progressive overload can be read and edited at once.
 */
export type PeriodizationRow = {
  movement: string;
  cells: (string | null)[];
};

export function buildPeriodizationRows(
  program: MaterializedProgram,
): PeriodizationRow[] {
  const byMovement = new Map<string, (string | null)[]>();
  const weekCount = program.weeks.length;

  for (const week of program.weeks) {
    for (const day of week.days) {
      for (const session of day.sessions) {
        for (const exercise of session.exercises) {
          const row =
            byMovement.get(exercise.name) ??
            Array.from({ length: weekCount }, () => null);

          const sets = exercise.sets.length;
          const reps = exercise.sets[0]?.reps;
          row[week.weekNumber - 1] = reps ? `${sets}x${reps}` : `${sets} sets`;
          byMovement.set(exercise.name, row);
        }
      }
    }
  }

  return [...byMovement.entries()]
    .map(([movement, cells]) => ({ movement, cells }))
    .sort((a, b) => a.movement.localeCompare(b.movement));
}

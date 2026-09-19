import {
  HARD_STIMULI,
  SAME_STIMULUS_GROUPS,
  type BlueprintPlacement,
  type LibraryExercise,
  type ProgramTemplateBody,
  type SessionSkeleton,
  type SetTarget,
  type Stimulus,
} from "./types";

/**
 * The template applier.
 *
 * A template is a recipe. This runs it through the client's Blueprint and
 * produces a materialized program the coach can then edit freely.
 *
 * Six rules hold, and each one holds because of how this is built rather than
 * because someone remembered:
 *
 *   1. A movement contraindicated for one of the client's flags is never
 *      chosen, because selection only ever draws from a pre-filtered pool, and
 *      the result is checked against that pool before it is returned.
 *   2. Sessions land on the client's preferred training days.
 *   3. The long run lands on the client's chosen day.
 *   4. Two hard sessions loading the same tissue never sit on consecutive days,
 *      because placement is a search that rejects any layout where they do.
 *   5. Lifting is capped at three sessions when a combat sport is present,
 *      because the cap is applied to the split before anything is placed.
 *   6. Rest days never receive a session, because they are removed from the
 *      candidate set before the search starts.
 *
 * Rules 1 and 4 are also asserted at the end. If either could be violated the
 * function throws rather than returning a program a coach might trust.
 */

export type MaterializedExercise = {
  exerciseId: string;
  name: string;
  sets: SetTarget[];
  trackingFields: string[];
  notes?: string;
  /** Set when the slot's first choice was not usable for this client. */
  substitutedFrom?: string;
};

export type MaterializedSession = {
  key: string;
  kind: SessionSkeleton["kind"];
  name: string;
  stimulus: Stimulus;
  fromTemplate: true;
  exercises: MaterializedExercise[];
  run?: SessionSkeleton["run"];
};

export type MaterializedDay = {
  date: string;
  dayOfWeek: number;
  isRest: boolean;
  sessions: MaterializedSession[];
};

export type MaterializedWeek = {
  weekNumber: number;
  startsOn: string;
  isDeload: boolean;
  days: MaterializedDay[];
};

/** Why the applier did something a coach might otherwise query. */
export type Decision =
  | { kind: "lift_cap"; from: number; to: number; reason: string }
  // `cause` is structured rather than inferred from the prose, because what a
  // coach is told about why a movement was removed has to be exactly right.
  // The pool is filtered on flags and nothing else today, so every
  // substitution is an injury one; an equipment filter added later has to say
  // so here rather than have the explanation guess.
  | {
      kind: "substitution";
      slot: string;
      from: string;
      to: string;
      cause: "injury" | "equipment";
      reason: string;
    }
  | { kind: "slot_dropped"; slot: string; reason: string }
  | { kind: "session_dropped"; session: string; reason: string }
  | { kind: "day_relaxed"; scope: "week"; reason: string };

export type MaterializedProgram = {
  weeks: MaterializedWeek[];
  decisions: Decision[];
};

export class TemplateApplyError extends Error {}

// ---------------------------------------------------------------------------
// Stimulus spacing
// ---------------------------------------------------------------------------

export function isHard(stimulus: Stimulus): boolean {
  return HARD_STIMULI.includes(stimulus);
}

/** Two sessions that load the same tissue hard enough to need a day between. */
export function sameStimulus(a: Stimulus, b: Stimulus): boolean {
  if (!isHard(a) || !isHard(b)) return false;
  if (a === b) return true;
  return SAME_STIMULUS_GROUPS.some(
    (group) => group.includes(a) && group.includes(b),
  );
}

// ---------------------------------------------------------------------------
// Exercise selection
// ---------------------------------------------------------------------------

/**
 * The pool a client is allowed to be given, computed once per program.
 *
 * Everything downstream draws from this and only this, which is what makes the
 * contraindication rule structural: there is no code path that reaches an
 * unsafe movement, because unsafe movements are not in the collection the
 * selector can see.
 */
export function safePool(
  library: LibraryExercise[],
  placement: BlueprintPlacement,
): LibraryExercise[] {
  const active = Object.entries(placement.flags)
    .filter(([, on]) => on === true)
    .map(([key]) => key);

  return library.filter(
    (exercise) => !exercise.contraindications.some((flag) => active.includes(flag)),
  );
}

function findByName(
  pool: LibraryExercise[],
  name: string,
): LibraryExercise | undefined {
  const wanted = name.trim().toLowerCase();
  return pool.find(
    (e) =>
      e.name.toLowerCase() === wanted ||
      e.aliases.some((a) => a.toLowerCase() === wanted),
  );
}

// ---------------------------------------------------------------------------
// Day placement
// ---------------------------------------------------------------------------

type Placement = { session: SessionSkeleton; day: number };

/**
 * Assigns sessions to days.
 *
 * Exhaustive with backtracking. There are at most seven days and a handful of
 * sessions, so the search is trivially cheap, and a search that rejects bad
 * layouts is the thing that makes rule 4 hold rather than a comment asking
 * someone to check afterwards.
 */
function placeSessions(
  sessions: SessionSkeleton[],
  candidateDays: number[],
  longRunDay: number | null,
  maxPerDay: number,
): Placement[] | null {
  const pinned: Placement[] = [];
  const free: SessionSkeleton[] = [];

  for (const session of sessions) {
    if (session.pinToLongRunDay && longRunDay !== null && candidateDays.includes(longRunDay)) {
      pinned.push({ session, day: longRunDay });
    } else {
      free.push(session);
    }
  }

  // Hardest to place first: a hard session has more ways to conflict.
  const ordered = [...free].sort((a, b) => {
    const hard = Number(isHard(b.stimulus)) - Number(isHard(a.stimulus));
    return hard !== 0 ? hard : a.key.localeCompare(b.key);
  });

  const placed: Placement[] = [...pinned];

  const dayGap = (a: number, b: number) => {
    const raw = Math.abs(a - b);
    // The week wraps: Saturday and the next Sunday are consecutive.
    return Math.min(raw, 7 - raw);
  };

  const fits = (candidate: Placement): boolean => {
    const onDay = placed.filter((p) => p.day === candidate.day);
    if (onDay.length >= maxPerDay) return false;
    // Two hard sessions never share a day.
    if (isHard(candidate.session.stimulus) && onDay.some((p) => isHard(p.session.stimulus))) {
      return false;
    }
    // Two hard sessions loading the same tissue never sit next to each other.
    for (const other of placed) {
      if (dayGap(other.day, candidate.day) > 1) continue;
      if (sameStimulus(other.session.stimulus, candidate.session.stimulus)) {
        return false;
      }
    }
    return true;
  };

  const search = (index: number): boolean => {
    if (index >= ordered.length) return true;
    const session = ordered[index];

    // Spread: prefer the day furthest from anything already placed, so a week
    // does not bunch into the front of itself.
    const bySpread = [...candidateDays].sort((a, b) => {
      const spread = (day: number) =>
        placed.length === 0
          ? 0
          : Math.min(...placed.map((p) => dayGap(p.day, day)));
      const diff = spread(b) - spread(a);
      return diff !== 0 ? diff : a - b;
    });

    for (const day of bySpread) {
      const candidate = { session, day };
      if (!fits(candidate)) continue;
      placed.push(candidate);
      if (search(index + 1)) return true;
      placed.pop();
    }
    return false;
  };

  return search(0) ? [...placed] : null;
}

// ---------------------------------------------------------------------------
// The applier
// ---------------------------------------------------------------------------

function isoDate(base: Date, addDays: number): string {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + addDays);
  return d.toISOString().slice(0, 10);
}

export function applyTemplate(input: {
  template: ProgramTemplateBody;
  placement: BlueprintPlacement;
  library: LibraryExercise[];
  startDate: string;
  weeks: number;
}): MaterializedProgram {
  const { template, placement, library, weeks } = input;
  const decisions: Decision[] = [];

  // --- Rule 5. The cap is applied to the split before anything is placed. ---
  const liftSessions = template.sessions.filter((s) => s.kind === "strength");
  const otherSessions = template.sessions.filter((s) => s.kind !== "strength");

  const liftCap = placement.combatSport ? 3 : template.split.liftsPerWeek;
  let chosenLifts = liftSessions.slice(0, Math.max(0, liftCap));

  if (placement.combatSport && liftSessions.length > 3) {
    decisions.push({
      kind: "lift_cap",
      from: liftSessions.length,
      to: chosenLifts.length,
      reason:
        "A combat sport is already the fourth and fifth hard session of the week, so lifting caps at three.",
    });
  }

  // Running off means run sessions never enter the plan at all.
  let chosenOthers = placement.runningEnabled
    ? otherSessions
    : otherSessions.filter((s) => s.kind !== "run");

  for (const dropped of otherSessions.filter((s) => !chosenOthers.includes(s))) {
    decisions.push({
      kind: "session_dropped",
      session: dropped.name,
      reason: "Running is switched off for this client.",
    });
  }

  // --- Rule 6. Rest days leave the candidate set before the search starts. ---
  const allDays = [0, 1, 2, 3, 4, 5, 6];
  const available = allDays.filter((d) => !placement.restDays.includes(d));

  // --- Rule 2. Preferred days first, widening only if the week cannot fit. ---
  const preferred = placement.preferredTrainingDays.filter((d) =>
    available.includes(d),
  );

  let sessions = [...chosenLifts, ...chosenOthers];
  let candidateDays = preferred.length > 0 ? preferred : available;

  // --- Rules 3 and 4 are decided by the search. ---
  let placements = placeSessions(
    sessions,
    candidateDays,
    placement.preferredLongRunDay,
    1,
  );

  if (!placements && candidateDays !== available) {
    // The preferred days cannot hold the week. Widen to every non rest day
    // rather than break the spacing rule, and say so.
    candidateDays = available;
    placements = placeSessions(
      sessions,
      candidateDays,
      placement.preferredLongRunDay,
      1,
    );
    if (placements) {
      decisions.push({
        kind: "day_relaxed",
        scope: "week",
        reason:
          "The preferred training days could not hold the week without putting two hard sessions of the same kind together, so the other non rest days were used.",
      });
    }
  }

  if (!placements) {
    // Allow an easy session to double up with a hard one, which is ordinary in
    // hybrid training, before giving up on a session.
    placements = placeSessions(
      sessions,
      candidateDays,
      placement.preferredLongRunDay,
      2,
    );
    if (placements) {
      decisions.push({
        kind: "day_relaxed",
        scope: "week",
        reason:
          "Two sessions share a day this week. They are never both hard.",
      });
    }
  }

  while (!placements && sessions.length > 0) {
    // Still impossible. Drop the lowest priority session and say which.
    const dropIndex = sessions.length - 1;
    const dropped = sessions[dropIndex];
    sessions = sessions.slice(0, dropIndex);
    decisions.push({
      kind: "session_dropped",
      session: dropped.name,
      reason:
        "The week cannot hold this session without breaking a rest day or putting two hard sessions of the same kind together.",
    });
    placements = placeSessions(
      sessions,
      candidateDays,
      placement.preferredLongRunDay,
      2,
    );
  }

  const layout = placements ?? [];

  // --- Rule 1. Selection draws only from the safe pool. ---
  const pool = safePool(library, placement);
  const poolIds = new Set(pool.map((e) => e.id));

  const materializeSession = (skeleton: SessionSkeleton): MaterializedSession => {
    const exercises: MaterializedExercise[] = [];

    for (const section of skeleton.workout?.sections ?? []) {
      for (const templateExercise of section.exercises) {
        const { slot } = templateExercise;
        const slotLabel = slot.preferred ?? slot.pattern;

        // 1. The coach's first choice, if this client may have it.
        let chosen = slot.preferred ? findByName(pool, slot.preferred) : undefined;
        let substitutedFrom: string | undefined;

        // 2. A declared swap on the first choice, injury swaps first.
        if (!chosen && slot.preferred) {
          const original = library.find(
            (e) => e.name.toLowerCase() === slot.preferred!.toLowerCase(),
          );
          const ranked = [...(original?.alternatives ?? [])].sort(
            (a, b) => Number(b.reason === "injury") - Number(a.reason === "injury"),
          );
          for (const alt of ranked) {
            const candidate = pool.find((e) => e.id === alt.id);
            if (candidate) {
              chosen = candidate;
              substitutedFrom = original?.name;
              break;
            }
          }
        }

        // 3. Anything safe with the same pattern. Deterministic by name so the
        //    same client and template always produce the same program.
        if (!chosen) {
          const byPattern = pool
            .filter((e) => e.pattern === slot.pattern)
            .sort((a, b) => a.name.localeCompare(b.name));
          if (byPattern.length > 0) {
            chosen = byPattern[0];
            substitutedFrom = slot.preferred;
          }
        }

        if (!chosen) {
          decisions.push({
            kind: "slot_dropped",
            slot: slotLabel,
            reason:
              "Nothing in the library covers this pattern that this client's flags allow.",
          });
          continue;
        }

        if (substitutedFrom && substitutedFrom !== chosen.name) {
          decisions.push({
            kind: "substitution",
            slot: slotLabel,
            from: substitutedFrom,
            to: chosen.name,
            cause: "injury",
            reason: "The first choice is ruled out by one of this client's flags.",
          });
        }

        exercises.push({
          exerciseId: chosen.id,
          name: chosen.name,
          sets: templateExercise.sets,
          trackingFields: templateExercise.trackingFields,
          notes: templateExercise.notes,
          substitutedFrom:
            substitutedFrom && substitutedFrom !== chosen.name
              ? substitutedFrom
              : undefined,
        });
      }
    }

    return {
      key: skeleton.key,
      kind: skeleton.kind,
      name: skeleton.name,
      stimulus: skeleton.stimulus,
      fromTemplate: true,
      exercises,
      run: skeleton.run,
    };
  };

  const start = new Date(`${input.startDate}T00:00:00Z`);
  const materializedWeeks: MaterializedWeek[] = [];

  for (let week = 1; week <= weeks; week += 1) {
    const isDeload =
      template.deload.everyNWeeks > 0 && week % template.deload.everyNWeeks === 0;

    const days: MaterializedDay[] = [];
    for (let offset = 0; offset < 7; offset += 1) {
      const dayIndex = (start.getUTCDay() + offset) % 7;
      const onThisDay = layout.filter((p) => p.day === dayIndex);

      days.push({
        date: isoDate(start, (week - 1) * 7 + offset),
        dayOfWeek: dayIndex,
        isRest: onThisDay.length === 0,
        sessions: onThisDay
          .sort((a, b) => a.session.key.localeCompare(b.session.key))
          .map((p) => materializeSession(p.session)),
      });
    }

    materializedWeeks.push({
      weekNumber: week,
      startsOn: isoDate(start, (week - 1) * 7),
      isDeload,
      days,
    });
  }

  // -------------------------------------------------------------------------
  // Invariants. These restate rules 1, 4 and 6 against the finished program.
  // If one fails the program is wrong in a way a coach would trust, so this
  // throws rather than returning it.
  // -------------------------------------------------------------------------
  assertProgramIsSafe(materializedWeeks, placement, poolIds);

  return { weeks: materializedWeeks, decisions };
}

/**
 * Checks the finished program against the rules that protect a client. Exported
 * so the same assertions can run in a test, and so any future code path that
 * builds a program can be held to them too.
 */
export function assertProgramIsSafe(
  weeks: MaterializedWeek[],
  placement: BlueprintPlacement,
  safeExerciseIds: Set<string>,
): void {
  for (const week of weeks) {
    for (const day of week.days) {
      // Rule 6.
      if (placement.restDays.includes(day.dayOfWeek) && day.sessions.length > 0) {
        throw new TemplateApplyError(
          `Week ${week.weekNumber} puts a session on a rest day (${day.date}).`,
        );
      }

      // Rule 1.
      for (const session of day.sessions) {
        for (const exercise of session.exercises) {
          if (!safeExerciseIds.has(exercise.exerciseId)) {
            throw new TemplateApplyError(
              `${exercise.name} is contraindicated for this client but appears on ${day.date}.`,
            );
          }
        }
      }

      // Two hard sessions never share a day.
      const hardToday = day.sessions.filter((s) => isHard(s.stimulus));
      if (hardToday.length > 1) {
        throw new TemplateApplyError(
          `${day.date} carries two hard sessions.`,
        );
      }
    }
  }

  // Rule 4, across the whole block including week boundaries.
  const flat = weeks.flatMap((w) => w.days);
  for (let i = 0; i < flat.length - 1; i += 1) {
    for (const a of flat[i].sessions) {
      for (const b of flat[i + 1].sessions) {
        if (sameStimulus(a.stimulus, b.stimulus)) {
          throw new TemplateApplyError(
            `${flat[i].date} and ${flat[i + 1].date} are back to back ${a.stimulus} and ${b.stimulus}.`,
          );
        }
      }
    }
  }
}

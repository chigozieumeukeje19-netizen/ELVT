/**
 * The shape the generated client app is built from.
 *
 * Read out of the database once at generation time and inlined into the file,
 * so the app opens with a full week already in it and works on a phone with no
 * signal. Everything after that comes from the API.
 */

export type ExportExercise = {
  id: string;
  name: string;
  /** Verified YouTube id. An exercise without one does not reach a client. */
  youtubeId: string;
  cues: string[];
  /**
   * Whether a weight box appears. Reps based work only: a timed hold, a run or
   * a rest day has nothing to weigh, and a box there teaches clients the app
   * does not know what it is asking for.
   */
  logsWeight: boolean;
  sets: { set: number; reps?: number; weight?: number; time?: number; rest?: number }[];
};

export type ExportSession = {
  id: string;
  kind: "strength" | "run" | "mobility" | "conditioning" | "skill";
  name: string;
  exercises: ExportExercise[];
  /** Runs carry their own targets rather than sets. */
  run?: {
    distanceTarget: number | null;
    paceMin: number | null;
    paceMax: number | null;
    hrMin: number | null;
    hrMax: number | null;
    fueling: string | null;
  };
};

export type ExportDay = {
  date: string;
  dayOfWeek: number;
  isRest: boolean;
  sessions: ExportSession[];
  calories: number | null;
  protein: number | null;
};

export type ExportWeek = {
  weekNumber: number;
  startsOn: string;
  isDeload: boolean;
  phase: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  plannedMileage: number | null;
  days: ExportDay[];
};

export type ExportMeal = {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  items: { name: string; portion: string }[];
};

export type ExportData = {
  client: {
    id: string;
    slug: string;
    firstName: string;
    lastName: string | null;
    units: "imperial" | "metric";
    timezone: string;
  };
  program: {
    name: string;
    startDate: string;
    weeks: number;
    goalStatement: string;
    raceDate: string | null;
  };
  weeks: ExportWeek[];
  meals: ExportMeal[];
  habits: { id: string; name: string; unit: string; target: number }[];
  /** Reference content. Always last on the page. */
  reference: { title: string; body: string }[];
  apiBase: string;
  generatedAt: string;
};

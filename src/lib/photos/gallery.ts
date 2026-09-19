/**
 * The photo gallery, and what it compares.
 *
 * Photos are the one thing in this product a client can see change that the
 * numbers cannot always show, so the comparison is the screen rather than a
 * feature on it. The preset pairs are the ones a coach actually asks for: the
 * start against the midpoint, the start against now, the start against the end.
 *
 * Nothing here holds a URL. A stored link to a private photo is a link that
 * keeps working after it leaks, so paths are stored and signed on read with a
 * short expiry.
 */

export const ANGLES = ["front", "side", "back"] as const;
export type Angle = (typeof ANGLES)[number];

export type Photo = {
  id: string;
  weekNumber: number;
  takenOn: string;
  angle: Angle;
  storagePath: string;
};

export type WeekSet = {
  weekNumber: number;
  takenOn: string;
  /** One per angle, or null where that angle is missing. */
  photos: Record<Angle, Photo | null>;
  /** How many of the three they actually took. */
  taken: number;
};

export function byWeek(photos: Photo[]): WeekSet[] {
  const weeks = new Map<number, WeekSet>();

  for (const photo of photos) {
    const existing = weeks.get(photo.weekNumber) ?? {
      weekNumber: photo.weekNumber,
      takenOn: photo.takenOn,
      photos: { front: null, side: null, back: null },
      taken: 0,
    };

    // The most recent wins, so a client retaking Monday's photo replaces it
    // rather than leaving two of the same angle in the same week.
    const current = existing.photos[photo.angle];
    if (!current || photo.takenOn >= current.takenOn) {
      if (!current) existing.taken += 1;
      existing.photos[photo.angle] = photo;
    }
    if (photo.takenOn < existing.takenOn) existing.takenOn = photo.takenOn;

    weeks.set(photo.weekNumber, existing);
  }

  return [...weeks.values()].sort((a, b) => a.weekNumber - b.weekNumber);
}

export type Comparison = { key: string; label: string; from: number; to: number };

/**
 * The preset comparisons.
 *
 * Built from the weeks that actually have photos rather than from the program's
 * length: offering "week 1 against week 8" to a client who has taken two sets
 * is offering a button that does nothing.
 */
export function comparisonsFor(weeks: WeekSet[], programWeeks: number): Comparison[] {
  if (weeks.length < 2) return [];

  const have = weeks.map((week) => week.weekNumber);
  const first = have[0];
  const latest = have[have.length - 1];

  const presets: Comparison[] = [];
  const add = (key: string, label: string, to: number) => {
    if (to === first || !have.includes(to)) return;
    if (presets.some((preset) => preset.to === to)) return;
    presets.push({ key, label, from: first, to });
  };

  add("quarter", `Week ${first} against week 4`, 4);
  add("half", `Week ${first} against week 8`, 8);
  add("final", `Week ${first} against week ${programWeeks}`, programWeeks);
  add("latest", `Week ${first} against week ${latest}`, latest);

  return presets;
}

/**
 * How long a signed link lives.
 *
 * Five minutes. Long enough to load a page and look at it, short enough that a
 * link pasted somewhere it should not be has stopped working before anyone
 * follows it. These are photographs of a person's body; the expiry is the point.
 */
export const SIGNED_URL_SECONDS = 300;

export const BUCKET = "client-photos";

/**
 * Where a client's photos live. One folder per client, keyed by their id.
 *
 * The path is built from the verified token's client_id and never from anything
 * a caller sends, so a caller cannot name a folder that is not theirs.
 */
export function pathFor(clientId: string, weekNumber: number, angle: Angle): string {
  return `${clientId}/week-${weekNumber}/${angle}`;
}

export function clientIdFromPath(path: string): string | null {
  const first = path.split("/")[0];
  return /^[0-9a-f-]{36}$/.test(first) ? first : null;
}

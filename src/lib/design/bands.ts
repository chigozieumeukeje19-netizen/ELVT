/**
 * Adherence and score bands.
 *
 * DESIGN.md Part 2: "The bands are stated here so the code reads them from
 * tokens, never from a literal." This module is the one place in the codebase
 * that knows 85 and 60. Nothing else compares a score to a number.
 *
 * The thresholds are parsed out of the CSS custom properties at runtime in the
 * browser, so the stylesheet stays the source of truth and a change to
 * tokens.css cannot leave the logic behind. On the server, and before styles
 * resolve, the constants below are used. A test asserts the two agree.
 */

export type Band = "ok" | "watch" | "flag";

/**
 * Mirrors --band-ok-min and --band-watch-min in src/styles/tokens.css.
 * Changing either of these without changing the other side is caught by
 * tests/unit/bands.test.ts.
 */
export const BAND_THRESHOLDS: Readonly<Record<"ok" | "watch", number>> = {
  ok: 85,
  watch: 60,
};

/** Reads the thresholds from the stylesheet when one is available. */
export function bandThresholds(): { ok: number; watch: number } {
  if (typeof window === "undefined" || typeof getComputedStyle !== "function") {
    return { ...BAND_THRESHOLDS };
  }

  const styles = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: number) => {
    const parsed = Number.parseFloat(styles.getPropertyValue(name));
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  return {
    ok: read("--band-ok-min", BAND_THRESHOLDS.ok),
    watch: read("--band-watch-min", BAND_THRESHOLDS.watch),
  };
}

/**
 * The band a score falls in. Adherence at or above 85 is on plan, 60 to 84 is
 * drifting, below 60 is actionable.
 */
export function bandFor(
  value: number | null | undefined,
  thresholds = BAND_THRESHOLDS,
): Band | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  if (value >= thresholds.ok) return "ok";
  if (value >= thresholds.watch) return "watch";
  return "flag";
}

/**
 * The CSS variable a band maps to. Callers use this rather than naming a color,
 * so a signal color can never be used for something that is not a signal.
 */
export function bandVar(band: Band | null): string {
  if (!band) return "var(--txt-mute)";
  return `var(--${band})`;
}

/** Tailwind text color class for a band. */
export function bandTextClass(band: Band | null): string {
  switch (band) {
    case "ok":
      return "text-ok";
    case "watch":
      return "text-watch";
    case "flag":
      return "text-flag";
    default:
      return "text-txt-secondary";
  }
}

/**
 * What each band means in words, for a title attribute or a screen reader.
 * The color is never the only carrier of the meaning.
 */
export function bandLabel(band: Band | null): string {
  switch (band) {
    case "ok":
      return "On plan";
    case "watch":
      return "Drifting";
    case "flag":
      return "Needs attention";
    default:
      return "No data";
  }
}

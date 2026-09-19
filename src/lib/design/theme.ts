/**
 * The two themes, and the one fact every part of the app agrees on.
 *
 * DESIGN_V2.md 2.2: light is not an afterthought, and every screen is checked
 * in both before it is locked. That check is only possible if light is
 * reachable without editing a file, so the choice lives in a cookie: the server
 * can read it before the first byte goes out, which means no flash of the wrong
 * theme and no hydration mismatch, and a test can set it on the browser context
 * the same way a person sets it with the toggle.
 *
 * Dark is the default and anything unrecognised resolves to it. A cookie is
 * user input; a value that is not one of the two names is not a third theme.
 */
export const THEMES = ["dark", "light"] as const;

export type Theme = (typeof THEMES)[number];

export const THEME_COOKIE = "elvt-theme";

/** A year. The choice is a preference, not a session. */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function readTheme(value: string | null | undefined): Theme {
  return value === "light" ? "light" : "dark";
}

export function otherTheme(theme: Theme): Theme {
  return theme === "light" ? "dark" : "light";
}

"use client";

import { useState } from "react";
import { MoonIcon, SunIcon } from "@/components/icons";
import {
  THEME_COOKIE,
  THEME_COOKIE_MAX_AGE,
  otherTheme,
  type Theme,
} from "@/lib/design/theme";

/**
 * The theme toggle.
 *
 * It writes the cookie the server reads and flips the attribute in the same
 * click, so the change is immediate and the next page load already agrees. No
 * reload, no flash, and no second source of truth: `data-theme` on the root and
 * the cookie are set together or not at all.
 *
 * The starting value comes from the server, which read the same cookie, so the
 * first paint is never wrong.
 */
export function ThemeToggle({ theme }: { theme: Theme }) {
  const [current, setCurrent] = useState<Theme>(theme);
  const next = otherTheme(current);

  return (
    <button
      type="button"
      data-testid="theme-toggle"
      aria-label={next === "light" ? "Switch to light" : "Switch to dark"}
      className="flex h-control w-control items-center justify-center rounded-md text-txt-secondary hover:bg-hover"
      onClick={() => {
        document.documentElement.dataset.theme = next;
        document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`;
        setCurrent(next);
      }}
    >
      {next === "light" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

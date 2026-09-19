import type { Config } from "tailwindcss";

/**
 * Tokens are declared once in src/styles/tokens.css and mapped here so a
 * Tailwind utility and a raw CSS rule can never drift apart.
 *
 * The default spacing, radius and font size scales are REPLACED rather than
 * extended. Left in place, the stock padding, radius and display sizes stay one
 * keystroke away, and reaching for them is exactly what DESIGN.md Part 1 bans.
 * Replacing the scales means the banned values cannot be typed at all.
 *
 * Only the alias roles are exposed. DESIGN_V2.md is explicit that components
 * consume roles and never primitives, so there is no `deep-700` utility to
 * reach for: a screen that wants a surface asks for a surface.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: ["selector", '[data-theme="light"] *'],
  theme: {
    // Only the portal's alias roles. There is no slate, zinc, gray, indigo or
    // violet to reach for, so the untouched-default tells cannot be typed by
    // accident, and no primitive either.
    colors: {
      transparent: "transparent",
      current: "currentColor",

      page: "var(--surface-page)",
      card: "var(--surface-card)",
      raised: "var(--surface-raised)",
      sunken: "var(--surface-sunken)",
      hover: "var(--surface-hover)",

      txt: "var(--txt)",
      "txt-secondary": "var(--txt-secondary)",
      "txt-tertiary": "var(--txt-tertiary)",
      "txt-inverse": "var(--txt-inverse)",

      line: "var(--border-subtle)",
      "line-default": "var(--border-default)",
      focus: "var(--border-focus)",

      ok: "var(--ok)",
      watch: "var(--watch)",
      flag: "var(--flag)",
      "ok-wash": "var(--ok-wash)",
      "watch-wash": "var(--watch-wash)",
      "flag-wash": "var(--flag-wash)",

      wordmark: "var(--wordmark)",
    },

    // 4px base. The twelve values in DESIGN_V2.md 1.3, no arbitrary lengths.
    spacing: {
      0: "var(--space-0)",
      px: "var(--space-px)",
      1: "var(--space-1)",
      2: "var(--space-2)",
      3: "var(--space-3)",
      4: "var(--space-4)",
      5: "var(--space-5)",
      6: "var(--space-6)",
      7: "var(--space-7)",
      8: "var(--space-8)",
      9: "var(--space-9)",
      10: "var(--space-10)",
      control: "var(--control-height)",
      marker: "var(--marker-width)",
      row: "var(--row-height)",
      "row-compact": "var(--row-height-compact)",
      sidebar: "var(--sidebar-width)",
      rail: "var(--rail-width)",
      topbar: "var(--topbar-height)",
    },

    // Five values plus full, by role. Tables, rows and the sidebar stay square,
    // and `full` is for status pills alone.
    borderRadius: {
      none: "var(--r-none)",
      sm: "var(--r-sm)",
      md: "var(--r-md)",
      lg: "var(--r-lg)",
      xl: "var(--r-xl)",
      full: "var(--r-full)",
    },

    // The scale in DESIGN_V2.md 1.2, nothing between. Weight travels with the
    // size because the spec pairs them, so `text-h1` is 24/32 at 700 and a
    // heading cannot end up at the wrong weight by omission.
    fontSize: {
      caption: ["var(--text-caption)", { lineHeight: "16px", fontWeight: "500" }],
      small: ["var(--text-small)", { lineHeight: "20px", fontWeight: "400" }],
      body: ["var(--text-body)", { lineHeight: "22px", fontWeight: "400" }],
      "body-strong": ["var(--text-body)", { lineHeight: "22px", fontWeight: "600" }],
      h3: ["var(--text-h3)", { lineHeight: "22px", fontWeight: "600" }],
      h2: ["var(--text-h2)", { lineHeight: "26px", fontWeight: "600" }],
      h1: ["var(--text-h1)", { lineHeight: "32px", fontWeight: "700", letterSpacing: "-0.02em" }],
      "metric-sm": ["var(--text-body)", { lineHeight: "20px", fontWeight: "600" }],
      metric: ["var(--text-metric)", { lineHeight: "26px", fontWeight: "600" }],
      "metric-lg": ["var(--text-metric-lg)", { lineHeight: "34px", fontWeight: "700" }],
      display: ["var(--text-display)", { lineHeight: "48px", fontWeight: "700", letterSpacing: "-0.02em" }],
    },

    fontFamily: {
      sans: ["var(--font-ui)", "system-ui", "sans-serif"],
      // Permitted in exactly two places: an id shown to a developer and a raw
      // timestamp. Never a weight, a calorie, a mile, a score or a percentage.
      mono: ["var(--font-mono)", "ui-monospace", "monospace"],
    },

    /*
     * Elevation is a surface step plus a top highlight, not a drop shadow.
     * `modal` is the only real shadow and `card` is none in dark and a soft
     * stack in light, so a card cannot pick up a shadow by accident in the
     * theme that forbids it.
     */
    boxShadow: {
      none: "none",
      "lift-1": "var(--lift-1)",
      "lift-2": "var(--lift-2)",
      card: "var(--shadow-card)",
      modal: "var(--shadow-modal)",
    },

    extend: {
      borderWidth: { DEFAULT: "1px" },
      maxWidth: { page: "var(--page-max)" },
      transitionDuration: {
        hover: "var(--motion-hover)",
        reveal: "var(--motion-reveal)",
        modal: "var(--motion-modal)",
      },
      transitionTimingFunction: {
        reveal: "var(--motion-ease)",
        hover: "var(--motion-ease-out)",
      },
    },
  },
  plugins: [],
};

export default config;

import type { Config } from "tailwindcss";

/**
 * Tokens are declared once in src/styles/tokens.css and mapped here so a
 * Tailwind utility and a raw CSS rule can never drift apart.
 *
 * The default spacing, radius and font size scales are REPLACED rather than
 * extended. Left in place, the stock padding, radius and display sizes stay one
 * keystroke away, and reaching for them is exactly what DESIGN.md Part 1 bans.
 * Replacing the scales means the banned values cannot be typed at all.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    // Only the portal palette. There is no slate, zinc, gray, indigo or violet
    // to reach for, so the untouched-default tells cannot be typed by accident.
    colors: {
      transparent: "transparent",
      current: "currentColor",
      ink: "var(--ink)",
      panel: "var(--panel)",
      "panel-2": "var(--panel-2)",
      line: "var(--line)",
      txt: "var(--txt)",
      "txt-mute": "var(--txt-mute)",
      "txt-dim": "var(--txt-dim)",
      ok: "var(--ok)",
      watch: "var(--watch)",
      flag: "var(--flag)",
      focus: "var(--focus)",
      wordmark: "var(--wordmark)",
    },

    // 4px base, seven steps. No arbitrary lengths.
    spacing: {
      0: "0px",
      1: "var(--space-1)",
      2: "var(--space-2)",
      3: "var(--space-3)",
      4: "var(--space-4)",
      5: "var(--space-5)",
      6: "var(--space-6)",
      7: "var(--space-7)",
      row: "var(--row-height)",
      sidebar: "var(--sidebar-width)",
      rail: "var(--rail-width)",
    },

    // Three values, by role. Nothing is pill shaped, so there is no full.
    borderRadius: {
      none: "0px",
      flat: "var(--radius-flat)",
      control: "var(--radius-control)",
      raised: "var(--radius-raised)",
    },

    // Six sizes, nothing between them.
    fontSize: {
      label: ["var(--text-label)", { lineHeight: "16px" }],
      body: ["var(--text-body)", { lineHeight: "1.45" }],
      emphasis: ["var(--text-emphasis)", { lineHeight: "1.4" }],
      section: ["var(--text-section)", { lineHeight: "1.25" }],
      name: ["var(--text-name)", { lineHeight: "1.1" }],
      hero: ["var(--text-hero)", { lineHeight: "1" }],
    },

    fontFamily: {
      sans: ["var(--font-ui)", "system-ui", "sans-serif"],
      mono: ["var(--font-mono)", "ui-monospace", "monospace"],
    },

    // Modals are the only surface allowed a shadow, and it is defined in CSS
    // on .elvt-modal. Nothing else can reach for one.
    boxShadow: {
      none: "none",
    },

    extend: {
      borderWidth: { DEFAULT: "1px" },
      transitionDuration: { state: "var(--motion-state)" },
      transitionTimingFunction: { state: "var(--motion-ease)" },
    },
  },
  plugins: [],
};

export default config;

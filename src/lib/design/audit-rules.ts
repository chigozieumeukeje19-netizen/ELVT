/**
 * The DESIGN.md Part 1 catalog, as machine checkable rules.
 *
 * Every rule here traces to a numbered tell and carries the concrete fix in
 * this project's tokens. DESIGN.md Part 3: "do not fix bg-violet-600 by
 * swapping in another nice color. Fix it with this project's actual token. A
 * fix that introduces a new unspecified default is not a fix."
 */

import { asPattern, EMPTY_STATE_FILLER, MARKETING_CLICHES } from "./banned-copy";

export type Severity = "high" | "medium";

export type Rule = {
  id: string;
  tell: number;
  title: string;
  severity: Severity;
  /** Applied per line. */
  pattern: RegExp;
  /** Which extensions this applies to. Empty means all scanned types. */
  extensions?: string[];
  /** The concrete fix, in this project's vocabulary. */
  fix: string;
  /** Paths this rule does not apply to, as substrings. */
  exempt?: string[];
};

/**
 * Files the audit reads. DESIGN.md Part 3 names these four.
 */
export const SCANNED_EXTENSIONS = [".ts", ".tsx", ".css", ".html"];

/**
 * Paths never scanned. The spec and this rule table both quote the banned
 * strings verbatim, so scanning them would report the catalog as a violation.
 */
export const SKIPPED_PATHS = [
  "node_modules/",
  ".next/",
  "test-results/",
  "playwright-report/",
  "src/lib/design/audit-rules.ts",
  "scripts/design-audit.ts",
  "tests/unit/design-audit.test.ts",
  "tests/fixtures/",
];

export const RULES: Rule[] = [
  // -------------------------------------------------------------------------
  // Tell 0. The tasteful default: cream plus serif plus sage. Co-top priority.
  // -------------------------------------------------------------------------
  {
    id: "cream-background",
    tell: 0,
    title: "Cream or beige page background",
    severity: "high",
    pattern:
      /#(?:faf8f5|f5f1e8|f3eee3|fdfbf7|f7f3ec|faf7f2|fdf9f3|f8f5f0)\b/i,
    fix: "Use --ink for the page and --panel for a surface. The cream set belongs to the client apps only and lives in src/styles/client-export-theme.css.",
  },
  {
    id: "cream-tailwind",
    tell: 0,
    title: "Warm neutral Tailwind background as the page surface",
    severity: "high",
    pattern: /\bbg-(?:stone|amber|orange)-(?:50|100)\b/,
    fix: "Use bg-ink for the page, bg-panel or bg-panel-2 for a surface.",
  },
  {
    id: "tasteful-serif",
    tell: 0,
    title: "The tasteful serif display face",
    severity: "high",
    pattern:
      /\b(?:Instrument[_\s]Serif|Fraunces|Playfair(?:[_\s]Display)?|Spectral|Cormorant(?:[_\s]Garamond)?|DM[_\s]Serif)\b/i,
    fix: "Display and UI is Archivo. The portal has no serif.",
  },
  {
    id: "sage-primary",
    tell: 0,
    title: "Sage or forest green as a primary",
    severity: "high",
    pattern:
      /#(?:15573a|1a4d3a|166534|14532d|15803d)\b|\b(?:bg|text|border)-(?:emerald|green)-(?:700|800|900)\b/i,
    fix: "The only green in the portal is --ok, and it means adherence at or above 85. Nothing else is green.",
  },

  // -------------------------------------------------------------------------
  // Tell 1. Untouched shadcn or Tailwind defaults.
  // -------------------------------------------------------------------------
  {
    id: "default-neutral-surface",
    tell: 1,
    title: "Stock Tailwind neutral as a surface color",
    severity: "high",
    pattern: /\b(?:bg|text|border)-(?:slate|zinc|gray|neutral)-\d{2,3}\b/,
    fix: "Use the portal tokens: bg-panel, bg-panel-2, text-txt, text-txt-mute, text-txt-dim, border-line.",
  },
  {
    id: "shadcn-card-trio",
    tell: 1,
    title: "The stock shadcn card class string",
    severity: "high",
    pattern: /rounded-lg\s+border\s+bg-card|bg-card\s+text-card-foreground/,
    fix: "Surfaces are borderless. Use .elvt-panel, separated by a 1px --line rule.",
  },
  {
    id: "shadcn-base-color",
    tell: 1,
    title: "components.json left at the generated base color",
    severity: "high",
    pattern: /"baseColor"\s*:\s*"(?:slate|zinc|gray|neutral|stone)"/,
    fix: "The portal does not use a shadcn base color. Tokens are in src/styles/tokens.css.",
  },
  {
    id: "default-radius-token",
    tell: 1,
    title: "Generated --radius value",
    severity: "high",
    pattern: /--radius\s*:\s*0\.5rem/,
    fix: "Radius is three role based values: --radius-flat 0, --radius-control 4px, --radius-raised 8px.",
  },
  {
    id: "single-radius-token",
    tell: 5,
    title: "One radius token reused on everything",
    severity: "medium",
    pattern: /--radius\s*:/,
    extensions: [".css", ".ts", ".tsx"],
    fix: "Radius is three role named tokens: --radius-flat, --radius-control, --radius-raised. A single --radius means one shape for every role.",
  },
  {
    id: "uniform-p6",
    tell: 1,
    title: "The uniform p-6 padding rhythm",
    severity: "medium",
    pattern: /\bp-6\b/,
    fix: "Spacing is 4/8/12/16/24/32/48 as p-1 through p-7, chosen per surface rather than applied everywhere.",
  },

  // -------------------------------------------------------------------------
  // Tell 2. AI purple.
  // -------------------------------------------------------------------------
  {
    id: "ai-purple-class",
    tell: 2,
    title: "Violet, indigo, purple or fuchsia",
    severity: "high",
    pattern: /\b(?:bg|text|border|from|via|to|ring)-(?:indigo|violet|purple|fuchsia)-\d{2,3}\b/,
    fix: "The portal has three saturated colors: --ok, --watch, --flag. Each means one thing. If this is not a signal, it is not colored.",
  },
  {
    id: "ai-purple-hex",
    tell: 2,
    title: "An AI purple hex",
    severity: "high",
    pattern: /#(?:6366f1|7c3aed|8b5cf6|a855f7|6d28d9|4f46e5|818cf8)\b/i,
    fix: "Use a signal token if this carries meaning, otherwise --txt or --txt-mute.",
  },
  {
    id: "ai-purple-hsl",
    tell: 2,
    title: "A primary at the AI purple hue",
    severity: "high",
    pattern: /--(?:primary|brand|accent)\s*:\s*(?:hsl\()?\s*(?:25[5-9]|26\d|27\d|280)\b/,
    fix: "The portal has no --primary. Interactive surfaces use --txt on --ink, signals use --ok, --watch or --flag.",
  },

  // -------------------------------------------------------------------------
  // Tell 3. Gradients and gradient text.
  // -------------------------------------------------------------------------
  {
    id: "gradient-text",
    tell: 3,
    title: "Gradient text",
    severity: "high",
    pattern: /bg-clip-text|(?:-webkit-)?background-clip\s*:\s*text/,
    fix: "Solid fills only. Zero gradients on text, ever.",
  },
  {
    id: "gradient-utility",
    tell: 3,
    title: "A Tailwind gradient",
    severity: "high",
    pattern: /\bbg-gradient-to-[trbl]{1,2}\b|\blinear-gradient\(/,
    fix: "Solid fills only. At most one restrained gradient in the whole portal, and only if it carries meaning, such as the hybrid stress heat scale.",
  },

  // -------------------------------------------------------------------------
  // Tell 4. Animation spam.
  // -------------------------------------------------------------------------
  {
    id: "motion-entrance",
    tell: 4,
    title: "Decorative entrance animation",
    severity: "high",
    pattern:
      /initial=\{\{[^}]*opacity:\s*0[^}]*\}\}|whileInView|data-aos=|animate-fade-?in|\banimate-in\b/,
    fix: "Motion only reports state: a value updating, a row saving, a queue item clearing. Use .elvt-value-updated, .elvt-row-saving or .elvt-queue-clearing.",
  },
  {
    id: "motion-hover-scale",
    tell: 4,
    title: "Hover scale",
    severity: "high",
    pattern: /hover:scale-\d|whileHover=\{\{[^}]*scale:/,
    fix: "No hover scale. A row that responds to hover changes its background to --panel-2 and nothing else.",
  },

  // -------------------------------------------------------------------------
  // Tell 5. Uniform rounding and pill buttons.
  // -------------------------------------------------------------------------
  {
    id: "pill-shape",
    tell: 5,
    title: "A pill shape",
    severity: "medium",
    pattern: /\brounded-full\b|border-radius\s*:\s*9999px|border-radius\s*:\s*99+px/,
    fix: "Nothing in the portal is pill shaped. Chips and buttons use rounded-control, 4px.",
  },
  {
    id: "large-radius",
    tell: 5,
    title: "A large uniform radius",
    severity: "medium",
    pattern: /\brounded-(?:xl|2xl|3xl)\b/,
    fix: "Three values by role: rounded-flat on tables, rows, inputs and the sidebar, rounded-control on buttons and chips, rounded-raised on modals.",
  },

  // -------------------------------------------------------------------------
  // Tell 6. Dark mode with unprompted neon glow.
  // -------------------------------------------------------------------------
  {
    id: "neon-glow",
    tell: 6,
    title: "A glow used as elevation",
    severity: "high",
    pattern: /(?:shadow|drop-shadow)-\[0_0_|box-shadow\s*:[^;]*\b0\s+0\s+\d+px[^;]*(?:rgb|hsl|#)/,
    fix: "Elevation comes from the panel step and a 1px rule. The only shadow in the portal is on .elvt-modal.",
  },
  {
    id: "neon-text",
    tell: 6,
    title: "Neon text on a dark surface",
    severity: "high",
    pattern: /\btext-(?:cyan|lime|fuchsia|sky)-(?:300|400)\b|\btext-green-400\b/,
    fix: "Text is --txt, --txt-mute or --txt-dim. A colored figure means a signal band and uses text-ok, text-watch or text-flag.",
  },

  // -------------------------------------------------------------------------
  // Tell 7. Emoji as icons.
  // -------------------------------------------------------------------------
  {
    id: "emoji",
    tell: 7,
    title: "An emoji in the interface",
    severity: "high",
    pattern:
      /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{1F900}-\u{1F9FF}]/u,
    extensions: [".tsx", ".html"],
    fix: "Real SVG icons or no icon. The set is in src/components/icons.tsx.",
  },

  // -------------------------------------------------------------------------
  // Tell 8. Default fonts.
  // -------------------------------------------------------------------------
  {
    id: "default-font",
    tell: 8,
    title: "A default font face",
    severity: "high",
    pattern:
      /\b(?:Inter_Tight|Inter|Geist(?:_Mono)?|Roboto(?:_Mono)?)\b(?!\w)/,
    fix: "Display and UI is Archivo, which has the width axis the labels need. Numbers are IBM Plex Mono.",
  },
  {
    id: "system-ui-only",
    tell: 8,
    title: "system-ui as the only declared face",
    severity: "medium",
    pattern: /font-family\s*:\s*(?:system-ui|-apple-system|sans-serif)\s*;/,
    fix: "Declare var(--font-ui) first, with system-ui only as the fallback behind it.",
  },

  // -------------------------------------------------------------------------
  // Tell 9. The symmetric card grid. In a portal this is the stat tile row.
  // -------------------------------------------------------------------------
  {
    id: "stat-tile-row",
    tell: 9,
    title: "A symmetric row of equal cards",
    severity: "medium",
    pattern: /grid-cols-3[^"'`]*\bgap-|md:grid-cols-(?:3|4)\b/,
    fix: "Hierarchy comes from size and position. Decide what the eye hits first and make it bigger, rather than lining up equals.",
  },
  {
    id: "marketing-headline",
    tell: 9,
    title: "A marketing scale headline",
    severity: "medium",
    pattern: /\btext-(?:4xl|5xl|6xl|7xl)\b/,
    fix: "Six sizes only: text-label, text-body, text-emphasis, text-section, text-name, text-hero.",
  },

  // -------------------------------------------------------------------------
  // Tell 10. Layout quality. The scanner can only catch the arbitrary value.
  // -------------------------------------------------------------------------
  {
    id: "arbitrary-spacing",
    tell: 10,
    title: "An arbitrary spacing value",
    severity: "medium",
    pattern: /\b(?:m|p)[trblxy]?-\[\d+(?:\.\d+)?(?:px|rem)\]/,
    fix: "Spacing is 4/8/12/16/24/32/48, as the 1 through 7 scale. If none of them fit, the layout is wrong, not the scale.",
  },

  // -------------------------------------------------------------------------
  // Tell 11. Copy clichés.
  // -------------------------------------------------------------------------
  {
    id: "copy-cliche",
    tell: 11,
    title: "Marketing cliché in copy",
    severity: "medium",
    pattern: asPattern(MARKETING_CLICHES),
    // The list itself is not copy. It lives in one file so the audit and the
    // AI voice check cannot drift, and that file is the one place skipped.
    exempt: ["tests/", "src/lib/design/banned-copy.ts"],
    fix: "Write what the thing does, in the voice the coach would use.",
  },
  {
    id: "empty-state-filler",
    tell: 11,
    title: "A placeholder empty state",
    severity: "medium",
    pattern: asPattern(EMPTY_STATE_FILLER),
    exempt: ["tests/", "src/lib/design/banned-copy.ts"],
    fix: "The empty state is the first thing seen on day one. Say what will appear here, when, and what the coach does next.",
  },

  // -------------------------------------------------------------------------
  // Project rules. These are not in the tell catalog, they are DESIGN.md Part 2
  // decisions that would otherwise erode quietly.
  // -------------------------------------------------------------------------
  {
    id: "band-literal",
    tell: 2,
    title: "An adherence band threshold written as a literal",
    severity: "high",
    pattern: /[<>]=?\s*(?:85|60)\b|\b(?:85|60)\s*[<>]=?/,
    extensions: [".ts", ".tsx"],
    exempt: ["src/lib/design/bands.ts"],
    fix: "Import bandFor from @/lib/design/bands. 85 and 60 are defined once, in tokens.css and bands.ts.",
  },
  {
    id: "client-theme-leak",
    tell: 0,
    title: "The client app cream theme imported into the portal",
    severity: "high",
    pattern: /client-export-theme/,
    extensions: [".ts", ".tsx", ".css"],
    exempt: ["src/styles/client-export-theme.css"],
    fix: "The cream theme is exempt for the client apps only. No portal screen may import it. The PWA exporter inlines it into its own document.",
  },
  {
    id: "gold-as-accent",
    tell: 0,
    title: "ELVT gold used as a UI accent",
    severity: "high",
    pattern: /#8A6F34/i,
    extensions: [".ts", ".tsx", ".css"],
    fix: "Gold appears in exactly one place, the sidebar wordmark, via the --wordmark token. Everything else uses --txt or a signal token.",
  },
];

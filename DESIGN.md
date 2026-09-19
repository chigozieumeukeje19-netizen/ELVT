# DESIGN.md

Binding design rules for the ELVT OS portal. Claude Code reads this before writing any UI code, and audits against it before any block is marked done. A build that lands any HARD FAIL below is not done, regardless of whether it works.

The one idea behind this whole file: a design reads as machine made when nobody decided anything. Every rule here either bans a default or forces a decision. A color, font or shape is never banned for being ugly. It is banned for being what autocompletes when no one chose.

---

## PART 1. HARD FAILS (the vibe coded tells)

Ranked by how often real people actually name them. Land even one and the portal reads as generated. Each has code signatures so the audit is mechanical.

### 0. The "tasteful default": cream plus serif plus sage. CO-TOP PRIORITY.

The single fastest rising tell of 2026, and the one most relevant to this project. A warm cream or beige page background, a serif display face for headings, and a sage or forest green accent. This is what the previous wave of anti-slop advice converged on, including Claude's own built-in frontend design skill, so it now reads as "AI tried to be tasteful." People call it out by name.

Code signatures:
- Page background `#faf8f5`, `#f5f1e8`, `#f3eee3`, `#fdfbf7`, `#f7f3ec`, or Tailwind `bg-stone-50`, `bg-stone-100`, `bg-amber-50`, `bg-orange-50` used as the page background
- Heading face Instrument Serif, Fraunces, Playfair Display, Spectral, Cormorant, DM Serif
- Primary around `#15573a`, `#1a4d3a`, emerald or green 700 to 900
- Any two of those three together is the strong signal

READ THIS CAREFULLY FOR THIS PROJECT: the ELVT client apps currently run cream `#FAF7F2` with Cormorant Garamond headings and a gold accent. That is two of the three. It is a real brand decision driven by a supplied wordmark, not a model default, so it stays in the client apps and is marked `unslop-ignore`. But the portal must NOT simply inherit it, because inheriting it is exactly how a chosen brand slides into the default look. The portal is a separate, internal, dense product and gets its own committed direction. See Part 2.

### 1. Untouched shadcn or Tailwind defaults

The most cited single cause of "they all look the same." Not the tools, the defaults.

Code signatures:
- Repeated `bg-slate-*`, `bg-zinc-*`, `bg-gray-*` as the card surface
- The stock card trio `rounded-lg border bg-card text-card-foreground shadow-sm` repeated with no theming
- `components.json` left at `baseColor: slate` or `zinc` with `cssVars` untouched
- `--primary`, `--ring`, `--radius: 0.5rem` left at generated values
- One uniform `p-6` padding rhythm on every surface

Test: could someone tell our card from the shadcn docs card in a screenshot? If not, it is not themed.

### 2. AI purple: violet or indigo primary

Code signatures: `indigo-*`, `violet-*`, `purple-*`, `fuchsia-*` as primary, CTA or link color. Hex `#6366f1`, `#7c3aed`, `#8b5cf6`, `#a855f7`, `#6d28d9`. Any `--primary` or `--brand` at HSL hue 255 to 280.

### 3. Gradients and gradient text

Code signatures: `bg-clip-text text-transparent`, `-webkit-background-clip: text`, `from-purple-* to-blue-*`, `from-violet-* to-indigo-*`, repeated `bg-gradient-to-*` across hero, buttons and cards.

Rule for this project: solid fills only. Zero gradients on text, ever. At most one restrained gradient anywhere in the whole portal, and only if it carries meaning, for example a heat scale on the hybrid stress rail.

### 4. Animation spam

Code signatures: `initial={{ opacity: 0, y: 20 }}` or `whileInView` repeated across sections, `whileHover={{ scale: 1.05 }}` on every card, `hover:scale-105` as a default, `data-aos="fade-up"` everywhere, scrolljacking.

Rule: motion only communicates state. A number changing, a row saving, a queue item clearing, a timer running. No decorative entrance animation anywhere. Always honor `prefers-reduced-motion`.

### 5. Uniform rounding and pill buttons

Code signatures: `rounded-2xl` or `rounded-3xl` applied broadly, `rounded-full` on every button, `border-radius: 9999px`, one single radius token reused on everything.

Rule: a radius scale of no more than three values, applied by role, not by habit. Decide which role gets which and write it in the tokens.

### 6. Dark mode with unprompted neon glow

Dark mode itself is fine. The glow nobody asked for is the tell. Code signatures: `shadow-[0_0_*]`, `drop-shadow-[0_0_*]`, large saturated `box-shadow` or `text-shadow`, bright `text-cyan-400`, `text-green-400`, `text-fuchsia-400` on `bg-black` or `bg-slate-950`.

### 7. Emoji as icons

Code signatures: emoji inside `h1`, `h2`, `h3`, feature card titles, list bullets, or standing in for UI icons. The usual suspects: rocket, sparkles, lightning, fire, lightbulb, lock, check, target, star.

Rule: real SVG icons or no icon. Zero emoji in any portal UI. This includes status chips, empty states and queue item types.

### 8. Default fonts

There are two default fonts now, not one. Inter, Inter Tight, Geist and Roboto are the "I did not pick a font" default. Instrument Serif, Fraunces, Playfair, Cormorant are the "I tried to pick a tasteful font" default. Both are autopilot.

Code signatures: `font-family: Inter` or `Geist` or `system-ui` as the only face, `next/font/google` importing one of the above with no real second face, Tailwind `font-sans` left at default.

NOTE FOR THIS PROJECT: the current scaffold picked Inter Tight. That is a named default and it must be replaced with a chosen pairing per Part 2.

### 9. The centered hero plus three feature cards skeleton

Code signatures: a `text-center` hero with a `text-5xl` or `text-6xl` headline and two buttons, immediately followed by `grid grid-cols-1 md:grid-cols-3` of icon cards. Repeated symmetric three up card grids.

Rule: this portal has no marketing page, so the equivalent failure is the dashboard version: a row of three or four identical stat cards across the top of every screen. Do not do it. Hierarchy comes from size and position, not from a symmetric grid of equals.

### 10. Layout quality tells (check these by eye, a scanner cannot see them)

- Text overflowing or clipping its container. Test every label with the longest real string, for example a 40 character client name and a 3 digit day count.
- Inconsistent spacing. Mixed unrelated padding and gap values, arbitrary `mt-[37px]`. One spacing scale, applied.
- Near misalignment. Edges that almost line up. Align to a grid.
- No information hierarchy. Every section the same weight. Decide what the eye hits first on each screen and make the layout say so.

### 11. Copy clichés

"Transform your X", "Supercharge", "Unleash", "Effortlessly", "Your X, reimagined", "Seamlessly". Also generic empty states like "Nothing here yet". Write what the thing actually does, in the voice the coach would use.

### 12. Do NOT chase these (cleared by the data, over-flagging wastes effort)

Mesh, aurora and blob backgrounds. Bento grids. Glassmorphism. Dark mode itself. shadcn and Tailwind themselves. None of these are real complaints. Only their untouched defaults are.

---

## PART 2. THE DIRECTION (locked 17 Sep 2026)

**Named direction: INSTRUMENT PANEL.** A dense, dark, read-first control surface for one operator monitoring eight to twenty athletes. The nearest honest comparison is a race engineer's timing screen, not a SaaS dashboard. It exists to let one person scan many people fast and decide, not to impress a visitor. It has no hero, no marketing page and no onboarding tour.

**Reference: the WHOOP app's data layer, restructured for one-to-many.** Three things are taken from it and nothing else. First, a narrow semantic color vocabulary that repeats on every screen so the language is learned once. Second, the primary metric rendered oversized and everything supporting it rendered small, so size alone carries hierarchy. Third, coaching is the data, there is no separate insight panel. Explicitly NOT taken: the neon glow used as elevation, which is hard fail 6.

Structural reference for the shell: a persistent left sidebar around 240px with the mark, icon and label navigation, fixed during scroll, main content filling the rest. Proven on dense operator tools and it matches the eight screens in Part 4 of the portal spec.

**Color decision.** Dark base, because the coach reads this early and often, and because it makes a small number of colored data points carry real weight.

```
--ink        #0E0F10   page
--panel      #16181A   surface
--panel-2    #1D2023   raised surface, table header
--line       #2A2E32   rule, 1px, the default separator
--txt        #F2F1EE   primary text
--txt-mute   #8C9196   labels, units, secondary
--txt-dim    #5A5F64   disabled, placeholder
```

Signal colors. These are the only saturated colors in the portal and each one means exactly one thing, everywhere, forever.

```
--ok         #4E9E6A   on plan, adherence 85 and above, completed
--watch      #C9A227   drifting, adherence 60 to 84, due today
--flag       #C04A38   actionable flag, adherence below 60, overdue, missed
--focus      #E8E6E1   selection and keyboard focus, no color
```

Desaturated on purpose. A screen showing eight clients will often carry all three at once, and saturated versions turn the roster into a Christmas tree. The bands are stated here so the code reads them from tokens, never from a literal.

**`--watch` stays at #C9A227. Settled, not open.** The dataviz method's palette validator fails it on one check of six when the three signal colors are run as a chart palette against the dark panel:

```
$ node validate_palette.js "#4E9E6A,#C9A227,#C04A38" --mode dark --surface "#16181A"
  [FAIL] Lightness band      outside band: #C9A227 at 0.728
  [PASS] Chroma floor        all 3 above the floor
  [PASS] CVD separation      worst pair ΔE 9.3 protan, 19.7 tritan
  [PASS] Normal-vision floor worst pair ΔE 16.3
  [PASS] Contrast vs surface all 3 at or above 3:1
```

Every check that decides whether the colors can be told apart passes, including under color vision deficiency, and by a comfortable margin: the target is 8 and the worst pair is 9.3. The one that fails is the lightness band, which exists so that no series in a chart shouts louder than the others.

These are not chart series. They are state signals on rows and figures, read one at a time against text, and a state that is drifting is *supposed* to catch the eye before a state that is on plan. Equal optical weight is the wrong goal for this job. Charts in this product are single series and take their marks from `--txt-mute`, so the signal colors never appear as a palette anyway; the one place a signal color touches a chart is the delta figure, which also says "up" or "down" in words.

Color is never the only carrier of meaning anywhere in the portal: `bandLabel()` gives every band a word, and a test holds that line. Nothing in the build depends on this decision, and it is recorded here so nobody spends another round on it.

ELVT gold `#8A6F34` appears in exactly one place: the wordmark in the sidebar. It is brand identity, not a UI accent. Using it for buttons or highlights would pull the portal toward the cream and gold client-app look, which is hard fail 0.

Nothing else gets color. No tinted cards, no colored section headers, no category colors.

**Type decision.** A pairing, chosen for two different jobs.

- Display and UI: **Archivo** (SIL Open Font License, variable, has a width axis). Chosen because it is a grotesk with real width control, so section labels can be set small, wide and uppercase with tracking, which is how timing and telemetry screens label things, and it is not on the autopilot list. Labels use Archivo Expanded at 11px uppercase with 0.08em tracking. Body and table text use Archivo regular.
- Numbers: **IBM Plex Mono** (SIL OFL) for every figure that sits in a column or gets compared: weights, calories, mileage, scores, dates, percentages. Monospaced tabular figures mean digits line up down a column without extra CSS, which is the whole reason dense tools reach for mono. Prose never uses it.

Banned as the heading face, per tell 8: Inter, Inter Tight, Geist, Roboto, Instrument Serif, Fraunces, Playfair, Cormorant. The current scaffold's Inter Tight is removed.

Scale: 11 label, 13 body, 15 emphasis, 20 section, 32 client name, 56 the one number a screen is about. Nothing between.

**Density decision.** The roster shows a minimum of 14 client rows above the fold at 1440 by 900. The Monday queue shows one full client card plus the top edge of the next, so it is obvious the list continues. Row height 44px. No card wraps a table. A table is a table.

Spacing scale, 4px base: 4, 8, 12, 16, 24, 32, 48. Nothing else, no arbitrary values.

Radius scale, three values only: 0 on tables, rows, inputs and the sidebar. 4px on buttons, chips and menus. 8px on modals and the Monday review card. Nothing is pill shaped.

Surfaces default to borderless. Separation comes from a 1px `--line` rule and from the panel step, not from a border plus a shadow on every box. There are no drop shadows except on modals.

**Layout intent per screen.**

- **Queue.** What needs a decision today. Opens to a single stacked list, highest attention first, each row expandable in place. First thing the eye hits: the count of items open. No stat tiles across the top.
- **Roster.** Who is drifting. A dense sortable table, one row per client, signal colors in the adherence and weight columns only. First thing the eye hits: the flagged rows, because they are the only colored things on the screen.
- **Client program.** What this person is doing this week. Week strip, then a seven column day grid. First thing the eye hits: the current week, marked, and the hybrid stress rail beside it.
- **Client nutrition.** Where the calorie path is going. The twelve week table is the screen, not a widget on it. First thing the eye hits: this week's row, highlighted.
- **Check-in review.** What they said and what changes because of it. Two columns: their answers left, the proposed changes right, each with accept, edit, reject. First thing the eye hits: the spine question, pinned.
- **Client overview.** Where this person stands. The one number that matters for their phase at 56px, everything else small around it.

**Motion.** Three uses only: a value updating, a row saving, a queue item clearing. Each under 150ms. No entrance animation, no hover scale, no scroll reveal. `prefers-reduced-motion` honored.

**Why this is a decision and not a default.** It is dark, and dark plus a dense table is the opposite of the current cream client app, which is correct because the two products have opposite jobs. The accent is an amber and a brick red rather than a framework blue or a tasteful green. The heading face has a width axis and is set in small caps labels, which almost nothing generated does. If any of this ever starts feeling like the obvious tasteful answer, per Part 4, it has become a default and needs rechoosing.

### Constraints that hold regardless of the direction chosen

1. The portal is coach facing, internal, used daily, often for fifteen minutes at a time on a Monday. It is a control surface, not a landing page. Optimize for scanning many clients fast, not for impressing a visitor.
2. It must be visibly a different product from the client apps. Same family, different job. The client app is calm and sparse because a client opens it mid set. The portal is dense because Darren is reading eight people at once.
3. Real data, always. Never an icon card where a number belongs. Never a placeholder where a client name belongs. Design every screen against the synthetic seed clients, including the long names and the empty states.
4. Every screen must survive three states: full of data, empty, and broken. Design the empty state deliberately, it is the first thing seen on day one.
5. Color carries meaning or it does not appear. A flag color means a flag. An adherence color means a band. Nothing is tinted for looks.

---

## PART 3. AUDIT PROCESS

Run before any block is marked done, and in CI.

1. Scan `.ts`, `.tsx`, `.css`, `.html` against every code signature in Part 1. Report file, line, the tell, severity and the concrete fix.
2. Render the real screens in Playwright at 1440px and 390px, screenshot them, and check tell 10 by eye against the catalog.
3. Report a vibe score and the top three fixes.
4. Gate the build on the high severity count.

Fixing well: do not fix `bg-violet-600` by swapping in another nice color. Fix it with this project's actual token. A fix that introduces a new unspecified default is not a fix.

Intentional choices: a line carrying an `unslop-ignore` comment is skipped. Use it only for real decisions recorded in Part 2, so the audit stays trustworthy.

---

## PART 4. WHY THIS FILE EXISTS

Models produce the statistical median of their training data. Distinctive design lives in the tails, and the median is exactly what a model reaches for when nothing was specified. So no adjective in a prompt fixes this. "Make it look premium" returns the average of everything labeled premium. Only a stated decision, written down and enforced, produces something that came from somewhere.

The trap this file is most at risk of: replacing one default with another. The 2024 default was the purple gradient on a dark hero. The 2026 default is cream, a serif and sage green. Swapping the first for the second is not a fix, it just resets the clock. If a rule in Part 2 ever starts feeling like the obvious tasteful answer, that is the signal it has become the new default and needs rechoosing.

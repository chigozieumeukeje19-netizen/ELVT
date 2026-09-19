# ELVT OS DESIGN SYSTEM v2 — "DEEP WATER"

A complete visual respecification. This supersedes Part 2 of DESIGN.md. Part 1
(the hard fails), Part 3 (the audit) and Part 4 (why this file exists) survive
unchanged and still govern, including the contraindication amendment.

Structure borrowed from the PYLO v2 spec: primitives, then alias roles, then
components. Components consume ONLY alias roles, never primitives.

## 0. THE ONE-PARAGRAPH DIRECTION

ELVT OS feels like a performance team's operations room rendered with care.
Deep navy surfaces rather than grey or near-black, elevation carried by
lightness rather than by borders, generous chrome around dense data. It is calm
around the edges and tight in the middle: the shell breathes, the tables do
not. This is the software one coach runs eight to twenty athletes from, so the
numbers stay aligned and scannable while everything around them stays quiet.
Color is almost absent and therefore means something when it appears. ELVT gold
survives as the wordmark and nothing else.

Anti-goals. Generic AI dashboards (purple gradients, glassmorphism, stat pill
rows). Cold technical tools (pure white on grey, blue-grey text, hairline boxes
everywhere). Consumer fitness apps (rings, confetti, saturated gradients,
cartoon energy). The 2026 tasteful default (cream page, serif display, sage
accent). Our own v1 near-black, which read as a terminal rather than as a
product.

## 1. PRIMITIVES (Tier 1)

### 1.1 Color scales (higher number = darker)

Navy ("deep") — the backbone. Blue-leaning neutral, never grey, never purple:

- `deep-25` #F6F8FB · `deep-50` #EDF1F7 · `deep-100` #DDE4EE · `deep-200` #C2CCDB
- `deep-300` #9BA8BC · `deep-400` #74829A · `deep-500` #55637B
- `deep-600` #3C485E · `deep-700` #2A3447 · `deep-800` #1C2434
- `deep-900` #141B28 · `deep-950` #0E141E

Signal colors. Three, and only three carry meaning:

- `ok-300` #6FBF93 · `ok-400` #4EA277 · `ok-500` #3A8760 · `ok-600` #2C6B4C
- `watch-300` #E0B653 · `watch-400` #C9982F · `watch-500` #A87D1E · `watch-600` #866315
- `flag-300` #E08076 · `flag-400` #CC5B4E · `flag-500` #B0453A · `flag-600` #8E362D

Gold (brand, wordmark only): `gold-400` #C9A961 · `gold-500` #A98B43 · `gold-600` #8A6F34

### 1.2 Typography

- Primary family: Archivo (400 / 500 / 600 / 700, variable, width axis
  available). Letter-spacing -0.01em on body, -0.02em on large headings. Inter,
  Inter Tight, Geist, Roboto, Instrument Serif, Fraunces, Playfair and
  Cormorant remain banned per Part 1 tell 8.
- Numerals: Archivo with `font-variant-numeric: tabular-nums` on every figure
  that sits in a column, gets compared, or reads as data. IBM Plex Mono is
  retired for data. Columns align on tabular figures alone, and the data then
  reads as part of the product rather than as a terminal readout.
- Mono is permitted in exactly two places: an id or token shown to a developer,
  and a raw timestamp. Never a weight, a calorie, a mile, a score or a
  percentage.
- All-caps letterspaced labels are retired. v1 set every label in 11px caps
  with 0.08em tracking, which reads as telemetry chrome. Labels are now
  sentence case.

Type scale (size / line-height / weight):

- `display` 44/48 · 700 — the one number a screen is about
- `h1` 24/32 · 700 — page titles
- `h2` 18/26 · 600 — section titles
- `h3` 15/22 · 600 — card titles
- `body` 14/22 · 400 — default
- `body-strong` 14/22 · 600
- `small` 13/20 · 400 — secondary
- `caption` 12/16 · 500 — labels, sentence case
- `metric-lg` 28/34 · 700 tabular — hero metrics on a card
- `metric` 20/26 · 600 tabular — card metrics
- `metric-sm` 14/20 · 600 tabular — table figures

### 1.3 Number scale (4px base)

`0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64`

Cards pad 20. Page gutters 32. Space between a section title and its content is
16. Space between one section and the next is 48.

This is tighter than PYLO on purpose. PYLO is a reading surface. This is a
scanning surface, and an operator covering twenty athletes pays for every 64px
of air with a row they cannot see.

### 1.4 Radii

`r-sm` 6 (inputs, badges, small controls) · `r-md` 8 (buttons) · `r-lg` 12
(cards) · `r-xl` 16 (modals) · `r-full` (status pills only).

Tables, rows and the sidebar stay square. A data grid with rounded rows reads
as a list of cards rather than as a table.

### 1.5 Elevation

Elevation goes LIGHTER, not darker, and is carried by surface lightness plus a
faint top highlight rather than by a drop shadow. This is the single rule that
makes a dark product feel considered rather than flat.

- `lift-1` background steps one surface lighter, plus `inset 0 1px 0 rgb(255 255 255 / 0.04)`
- `lift-2` steps two lighter, plus `inset 0 1px 0 rgb(255 255 255 / 0.06)`
- `shadow-modal` 0 16px 48px rgb(5 8 13 / 0.55), used on modals and popovers ONLY

Hairline borders are demoted to rare separators. A table's row rule is the main
survivor.

### 1.6 Motion

150ms ease-out on hover, 200ms cubic-bezier(0.2, 0, 0, 1) on reveals, 250ms on
modals. Elements settle, never bounce. Motion communicates state only: a value
updating, a row saving, a queue item clearing. No entrance animation, no hover
scale, no scroll reveal. `prefers-reduced-motion` honored everywhere.

## 2. ALIAS ROLES (Tier 2). Components consume ONLY these.

### 2.1 Dark (the default, and the one that matters)

ELVT OS is dark first. The coach opens it early and often, and a dark canvas
makes a small number of colored data points carry real weight.

- `surface/page` → `deep-950` #0E141E
- `surface/card` → `deep-900` #141B28, one step LIGHTER than the page, with the `lift-1` top highlight
- `surface/raised` → `deep-800` #1C2434, lighter still (popovers, dropdowns, modals)
- `surface/sunken` → #0A0F17, slightly darker than the page (input wells, table header rows)
- `surface/hover` → one step lighter than the element's rest surface
- `text/primary` → #E8EDF4 (soft, never pure white) · `text/secondary` → `deep-300` #9BA8BC · `text/tertiary` → `deep-400` #74829A · `text/inverse` → #0E141E
- `border/subtle` → rgb(255 255 255 / 0.06) · `border/default` → rgb(255 255 255 / 0.10) · `border/focus` → #E8EDF4 at 1px plus a 3px ring at 18%
- `accent/wordmark` → `gold-400` #C9A961. The sidebar wordmark and nothing else, ever.
- `state/ok` → `ok-300` #6FBF93 on ok at 12% · `state/watch` → `watch-300` #E0B653 on watch at 12% · `state/flag` → `flag-300` #E08076 on flag at 12%
- `chart/1..4` → `deep-200`, `ok-300`, `watch-300`, `deep-400`

Note the focus ring carries no color. Focus is a state of the interface, not a
state of the data, and coloring it would dilute the three signals.

### 2.2 Light (secondary, must still be verified)

Same layout, same components, roles swap. Light mode exists for daylight and
for printing a client summary.

- `surface/page` → `deep-50` #EDF1F7 · `surface/card` → #FFFFFF with `shadow-sm` 0 1px 2px rgb(14 20 30 / 0.05), 0 2px 8px rgb(14 20 30 / 0.04) · `surface/raised` → #FFFFFF with a deeper stack · `surface/sunken` → `deep-100` #DDE4EE
- `text/primary` → `deep-900` · `text/secondary` → `deep-500` · `text/tertiary` → `deep-400`
- `border/subtle` → `deep-100` · `border/default` → `deep-200`
- `state/ok` → `ok-600` on `ok-50` · `state/watch` → `watch-600` on `watch-50` · `state/flag` → `flag-600` on `flag-50`

In light mode elevation reverses to the conventional white-card-on-tinted-page
with a soft shadow. Do not carry the dark lightness rule across.

Every screen must be checked in both themes before it is locked. A
token-correct page can still read wrong: a highlight that vanishes, a signal
that oversaturates, a chart fill too faint to see.

### 2.3 How color is used now

Color appears ONLY as: a signal state on a figure that has a defined threshold,
the gold wordmark, and a chart series. It never fills a card, never tints a row,
never colors a section header, never marks a category, and never appears in more
than about four places in a viewport.

Contraindications are the one exception, per the amendment already in DESIGN.md:
`state/flag` may mark a contraindication at the point of action, meaning the
exercise detail header and the swap sheet. Never in a list, table column, chip
or roster row.

### 2.4 THE ADHERENCE SEMANTIC (locked, propagates to every figure)

This is ELVT's version of PYLO's money semantic and it is the most important
rule in this document. Every figure on every screen resolves to exactly one of
four states. Green is earned, never a default.

- **Neutral.** A figure with no defined threshold, a count, a raw measurement,
  or a category with nothing planned. Renders in `text/primary` with no color.
  A rest day with zero sessions is neutral, not a failure. A client on week 1
  with no trend is neutral.
- **On plan.** `state/ok`. Only where a real threshold exists and the figure
  clears it: adherence at or above 85, a target hit, a session completed as
  prescribed.
- **Drifting.** `state/watch`. Adherence 60 to 84, a check-in due today, a trend
  heading the wrong way across two weeks but not yet actionable.
- **Flagged.** `state/flag`. Adherence below 60, an overdue check-in, a missed
  session, or a client trigger that has actually fired.

Rules that follow from it:

- **Absent is not zero.** A missing reading renders as an em dash in
  `text/tertiary` with a caption saying what is missing and when it would
  arrive. It is never colored and never counted as a miss.
- **A weight figure is neutral by default.** Weight moving in either direction
  is only good or bad against a stated goal direction on that client's
  blueprint. Absent that, no color.
- **Bands live in one place.** 85 and 60 are defined once, in the bands module,
  and every consumer reads them. A card that sorts to the top of the queue is
  the same client whose roster row is flagged.
- **Implement once as a shared helper.** Every figure inherits it rather than
  each screen re-deciding.

## 3. COMPONENT PATTERNS (Tier 3)

### 3.1 App shell

- Sidebar 248px, `surface/page` (blends with the page, no panel color), no
  border. ELVT wordmark at top in `accent/wordmark`, 20px tall. Nav groups
  labeled in `caption` `text/tertiary`, sentence case. Nav items 36px, `r-md`,
  `text/secondary`; hover washes to `surface/hover`; active becomes
  `surface/card` with `lift-1` and `text/primary`, plus a 3px
  `accent/wordmark` dot on the left edge. Exactly one active item. Icons 18px,
  1.5px stroke. Collapses to a 64px icon rail below `lg`.
- Top bar 52px, transparent: breadcrumb left, search field center (sunken,
  `r-md`, "Search clients"), right side carries the theme toggle and the coach
  avatar. No border below. Content just begins.
- Page container max width 1280, 32 gutters. The roster and the queue are the
  two exceptions and run full width, because both are dense tables where
  horizontal room buys visible columns.

### 3.2 Page header (every page)

`h1` title plus a one-line `small` `text/secondary` description. Right-aligned
action area. No colored banners. No hero blocks. The header costs vertical
space that the roster needs, so it stays to a single line and the count sits
beside its label rather than stacked beneath it.

### 3.3 Metric tiles

`surface/card`, `r-lg`, `lift-1`, pad 20. Label in `caption` `text/secondary`
sentence case. Figure in `metric` or `metric-lg` tabular, colored by the
adherence semantic. Sub-line in `caption` `text/tertiary`.

- Never a symmetric row of equal tiles. That is hard fail 9. Where a screen has
  six figures, one of them is the summary and gets `display` at 44px while the
  other five sit small beside it. On the client overview that number is the
  ELVT score.
- **Pending state.** An unwired or absent figure renders as an em dash in
  `text/tertiary` with a `caption` saying what it is waiting for. Quiet, never
  fake, never zero.

### 3.4 Tables (the core of this product)

Headers in `caption` 500 `text/tertiary` sentence case on `surface/sunken`.
Rows 48px, separated by `border/subtle` only, hover washes to `surface/hover`.
Density toggle 48 / 40. No zebra striping. Numeric columns right aligned,
tabular figures. First column carries the client name in `body-strong` with
their phase in `small` `text/tertiary` beneath.

- Density target stands: at least 14 roster rows above the fold at 1440 by 900.
  If the header or filter bar grows, they lose the argument, not the rows.
- Wide tables scroll inside their own container. The page never scrolls
  sideways.
- A table is a table. Never wrapped in a card.

### 3.5 Status pills

`r-full`, 12px 500, soft tinted backgrounds from the adherence semantic. On
plan, Drifting, Flagged, Neutral. Program phase and client status render as
neutral pills, since neither is a judgment. A dot-prefix variant exists for
compact tables.

### 3.6 Buttons

- Primary: `text/primary` background with `text/inverse` text, `r-md`, 36px,
  500. One per view region. Light on dark rather than a colored fill, which
  keeps the three signals unspent. Never rendered disabled and faded: validate
  on submit and mark the offending field.
- Secondary: transparent with `border/default`, `text/primary`, hover washes.
- Ghost: text only in `text/secondary`, hover washes.
- Destructive: secondary style with `state/flag` text until confirm. Row level
  deletes confirm in row, not in a modal.
- Icon buttons 32px, `r-md`, ghost.

### 3.7 Inputs and filters

Inputs on `surface/sunken`, no border at rest, `r-sm`, 36px. Focus lifts to
`surface/card` plus the focus ring. Labels above in `small` 500. Only optional
fields are marked optional; required fields carry no asterisk.

Filter bar is one quiet row: a segmented control on a sunken track with the
active segment lifted, select pills, and a joined date range control. Never a
native date input. Filters read as furniture.

### 3.8 Charts

One line per chart, no legend. Marks carry no color: the line is
`text/secondary` and only a threshold breach picks up a signal color. Soft grid
lines in `border/subtle`, no axis boxes. Area fills at 10% on dark. The end of
the line is labeled and nothing else is. Every chart carries a text description
of which way it went, so the direction is never conveyed by shape alone. A
chart opens showing four series maximum and says how many more there are.

### 3.9 Empty states, modals, toasts

Empty states say what will appear here and when, never that there is nothing.
Centered 40px pictogram tile on `surface/sunken` at `r-lg`, an `h3` line, a
`small` sub, and one action where an action exists. Modals at `r-xl`,
`surface/raised`, `shadow-modal`, pad 24, scrim rgb(5 8 13 / 0.55), close on
scrim click, close button and Escape. Toasts bottom right on `surface/raised`
with a signal keyline.

### 3.10 The Monday card

The one screen this product is judged by. Everything needed to decide sits on
the card in reading order with nothing to open: weight trend, the five
adherence fractions across one row, their check-in with the spine question
pinned first, the flags, then each proposed change with its own accept, edit
and reject.

The card must fit in 900px of viewport with the top edge of the next card
visible, so the reader knows the list continues. Where it does not fit, the
card loses height, not the rule.

### 3.11 Expand pattern

Where a card caps what it shows, an expand control in the top right opens the
full breakdown in a modal, and the modal can go full screen where extra columns
earn it. The column set stays constant regardless of any active toggle: a
toggle changes which figure is visualized, never which columns exist. Any
inherited toggle is one shared state across all three levels and never resets.

## 4. VOICE AND MICRO-COPY

- Sentence case everywhere: buttons, labels, headers, nav.
- Direct and plain. "Nothing needs you today." not "NO ACTIONS REQUIRED".
- No em dashes or en dashes in any user-facing copy. The only permitted em dash
  is a rendered data placeholder for an absent value. Numeric ranges use "to".
- US English throughout.
- Numbers never lie. A figure agrees with its own label and denominator, or the
  contradiction is surfaced rather than hidden.
- No banned copy clichés: transform, supercharge, unleash, effortlessly,
  seamlessly, reimagined.

## 5. MIGRATION

This is a retint and a re-spacing, not a rebuild. Every screen already exists
and every screen already has a preview route and visual assertions.

1. Replace the token file. All surface, text, border and signal values come
   from Section 2. Nothing outside the token file names a color.
2. Type: keep Archivo, add `tabular-nums` where numbers live, retire mono for
   data, drop the all-caps letterspaced label style for sentence case captions.
3. Elevation: replace every border-defined card with the surface-step plus top
   highlight. Keep the table row rule.
4. Radii and spacing to Sections 1.3 and 1.4.
5. Implement the adherence semantic as one shared helper and route every figure
   through it. This is the item most likely to surface inconsistencies already
   in the build, so do it before the visual pass rather than after.
6. Re-run the design audit. Update any rule that names a v1 value, in
   particular the ink base assertion, the mono face assertion and the cream
   check. The cream check stays: the client app theme is a separate token file
   and the portal must never reach for it.
7. Verify every preview screen in BOTH themes at 1440 by 900 and 390 by 844.
   Dark is the default and light is not an afterthought.
8. The density assertions stand unchanged. If the new spacing costs roster
   rows, the spacing loses.

The hard fails in DESIGN.md Part 1 are unchanged and still enforced. Note that
this spec deliberately moves toward two things the old Part 2 forbade: larger
radii and shadows. Both are now permitted within the scales above, and both
remain banned as uniform defaults. A `rounded-2xl` on everything and a drop
shadow on every box are still failures.

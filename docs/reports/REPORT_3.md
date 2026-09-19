# Report 3: items 17 to 23, the loop walk, and what I would not trust yet

Client API, PWA exporter, Base44 files, progress, photos, roster filters, race
mode. Then the whole loop walked once, end to end.

---

## What every gate says

```
npm test              29 files, 655 tests, all passing
design audit          0 high, 0 medium, vibe score 100
typecheck             clean
npm run db:verify     12 migrations apply cleanly to an empty database, seed lands
npm run db:conformance 12 assertions, the shim matches production
npm run db:api-rls    48 assertions, one per client API endpoint plus storage and races
npm run loop:walk     9 of 9 steps
npm run test:e2e      342 passing, 8 FAILING, 3 not run
```

The eight failures are the auth tests, every one of them, and they are the
same eight that have failed since item 0. They need GoTrue, GoTrue needs a
Docker image, and no image can be pulled in this container. That is open
question 1 and it is the first thing to re-run on a machine with Docker. The
suite says so out loud rather than reporting a pass:

```
AUTH COVERAGE: 8 of 11 auth tests ran, 3 SKIPPED.
The login flow is UNPROVED. Nothing in this run signed anyone in.
```

Three did not run because the suite stops adding failures after ten.

---

## The loop walk

`npm run loop:walk` builds a throwaway database from the migrations and the
synthetic seed, then runs the nine steps of the final check through the real
modules, writing real rows under the real constraints. Every step passes with
a fact behind it or fails with the reason. Nothing skips.

```
The nine step loop walk
=======================

Database: elvt_loop

  [PASS] 1. Add a client, send the intake, complete it
         Client created, intake accepted with no validation issues, 38 of 46 questions answered, response stored as submitted.
  [PASS] 2. The Blueprint drafts and the coach approves it in one screen
         Derived a 12 week recomp with the spine flag and running off, proposed 2 triggers, approved in one update.
  [PASS] 3. The program materializes respecting every flag, and week 12 is the goal state
         84 days written, 24 substitutions explained, calorie path 2150 to 2000 with week 12 equal to the goal state.
  [PASS] 4. The client sees day one, logs a session with weights, and submits the daily check-in
         Day one served a session, 6 sets logged with the prescription beside each result, daily form of 7 questions submitted, day scored 100.
  [PASS] 5. The week rolls Sunday night, score and streak compute, the weekly form arrives
         Rolled at 23:59 local, 12 writes, week scored 89.28 with movement focus, streak 7, weekly form for 2026-10-04 with the weigh-in first.
  [PASS] 6. The Monday queue shows the card, and Accept All applies it
         One card, five adherence lines, spine question pinned first, 2 of 3 changes applied and 1 rejected, message sent, card closed.
  [PASS] 7. A trigger fires and its suggested message is waiting
         steps_low:f76b8078-7d62-4b7a-8d00-7298b8e0d5f8:2026-09-28 fired on 2026-09-28 after two days under the goal, message waiting in the queue, a second run on the same evening added nothing.
  [PASS] 8. Every audit passes on the generated client app, legacy saved state included
         File generated at 29 KB, every audit clean (0 findings), and the legacy saved state merge is in the file.
  [PASS] 9. The spinal fusion client receives no barbell back squat across all 84 days
         72 movements across 84 days, zero of them contraindicated for the spine, 24 substitutions made and explained.

9 of 9 steps passed.

The loop walks end to end.
```

The exercise library is the one fixture in it. The real import is blocked and
the standing rules forbid seeding placeholders, so the walk inserts
`tests/fixtures/program.ts` into its own database and marks the rows
`import_source = 'loop_walk_fixture'`. That fixture exists precisely because it
carries a barbell back squat, which is the only way step 9 can mean anything.

### What the walk found

**The calorie path shapes were two lists that had drifted.** The Builder's
template form offered `linear`, `front_loaded`, `mileage_linked` and
`muscle_gain`. The generator knew `linear`, `front_loaded`, `mileage_linked`
and `rising`. A coach who picked "muscle gain" saved a template whose calorie
path could never be generated, and nothing caught it because no test had ever
handed a template body to the generator. They are now one list, exported from
the generator, with a test that fails if they diverge again. `rising` is the
name that survived: the other three describe the shape of the line and
`muscle_gain` describes a goal, which is also already a `GoalType`.

That is what a walk is for. Twenty-nine test files did not find it because each
one was testing its own half.

**Seven controls were run on the walk itself**, each breaking a rule and
confirming the step goes red:

| Broken | Step that failed |
|---|---|
| The spine flag never reaches the applier | 9, the back squat reached the client |
| Week 12 does not land on the goal state | 3 |
| The trigger fires again on the same evening | 7 |
| The spine question is not pinned to the top | 6 |
| The weigh-in is not the first weekly question | 5 |
| A logged set forgets the prescription | 4 |
| The calorie shapes drift apart again | the new unit guard |

The first control also taught me something about the walk: its assertion about
substitutions ran before the rows were written, so breaking one rule turned one
failure into seven and hid which was real. The assertions that describe the
result now run after it lands.

---

## What is built in this block

### Item 17. Client API

Sixteen endpoints under `/api/v1`, every one of them running as the caller.
`handler` wraps each route with a Supabase client carrying the client's own
JWT, and the service role is not reachable from any of them except
`auth/exchange`, which is the one endpoint that has to look a client up before
there is a client to be.

The bound is at the database, not in the handler. `tests/sql/api_rls_checks.sql`
makes one assertion per endpoint against a second client's rows: 48 of them
now, each fixture built rather than looked for, every catch narrowed to
`insufficient_privilege` so a wrong column name cannot pass as a refusal.

A policy bounds rows; only a grant bounds columns. `revoke update ... grant
update (cols)` is what stops a client marking their own session complete and
moving it to a different day in the same request.

### Item 18. PWA exporter

One HTML file, no build step, no network needed to open it. Four audits run
against the generated file rather than the generator, because auditing the
generator passes on the day someone bypasses it: render never scrolls, older
saved state still opens, one broken card does not take the page, and every card
is present in the fixed order.

### Item 19. Base44 backend functions

Three files, as files, with the exchange flow and the webhook.

### Item 20. Progress tab

Four metrics by phase, everything else behind one chip. Charts built with the
dataviz method: one series, no legend, 2px lines, marks in muted ink and the
signal colour only on the delta, which also says "up" or "down" in words. CSV
export with RFC-correct quoting.

### Item 21. Photos

By week and side by side, every URL signed and expiring in five minutes,
nothing stored. Read as the coach so RLS decides whose photos these are; the
service role signs only paths that came back from that read.

### Item 22. Roster filters and bulk actions

Five filters, AND not OR. Two numbers that had to be honest: the count beside
each filter is computed against what is already selected, and every bulk button
says how many it would actually change. A filter matching nobody stays on
screen, disabled, saying zero.

### Item 23. Race mode

The countdown counts from the day being viewed, not from today, and nothing in
`src/lib/race/mode.ts` reads a clock. Taper length by distance, taper start,
race pace, fueling plan, race week checklist, planned against completed
mileage. A fueling plan is refused rather than invented when there is nothing
to base a duration on. Taper weeks are not banded, because under plan in a
taper week is what a taper is for.

The client app gets a race card that appears with the taper and goes the
morning after. It computes none of it: everything that does not depend on the
viewed date is resolved at export time by the same module the portal uses, and
an audit fails the file if a number other than 0 or 1 appears in that card.

---

## Controls

Across items 17 to 23, 41 controls, each one breaking a rule, confirming the
test goes red, and restoring. Every one bit. Nine of them did not bite on the
first attempt, and all nine were gaps in my own checks rather than in the code:

- Three PWA controls: the error card still counted as visible, the logs were
  keyed by date so archiving was redundant, and the queue filled either way.
- Three API controls, where I was reading the wrong line of the vitest output.
- The roster dead-filter control, because the visual suite runs against a
  production build in `.next` and I had not rebuilt.
- The export race-audit control, where my first rule looked for arithmetic
  operators and reported `race.fueling.gels + " gels"`, which is string
  concatenation. It now forbids the numbers instead, which is the only form a
  regex can actually check.
- The walk's spine control, described above.

---

## Two pieces of plumbing that were quietly broken

Both were the same shape: a setting that lived in `.env.local` and was read by
some consumers and not others, so it was real for whichever shell had run
`export` and invisible to every other one.

- **Vitest did not read `.env.local`**, so `ELVT_DB_URL` was invisible to it
  and the schema, RLS, insert and shim suites failed with "cannot reach
  Postgres" on a machine where Postgres was running and configured.
- **`scripts/lib/db.sh` did not read it either**, so `npm run db:verify` said
  the same thing.

Both now read it the way `playwright.config.ts` already did. Playwright also
now resolves whichever Chromium revision is installed rather than the one it
would otherwise download, which is not reachable here. It does not fall back
silently: with nothing installed it leaves the path unset and fails with its
own message naming the missing revision.

---

## What I would not yet trust with a real client

**1. The login flow.** It has never signed anyone in, anywhere, in this
container. Eight tests fail for want of GoTrue. Everything downstream of a
session is proved; the session itself is not. This is the one thing to check
before anything else, and it is open question 1.

**2. Anything that needs the exercise library.** It is empty, deliberately.
Every screen degrades to an empty library rather than to wrong data, and the
loop walk proves the applier's contraindication filter with a fixture, but no
real client has been through it with real movements. The spinal fusion
assertion is only as good as the library it filters, and the real library does
not exist yet.

**3. The client detail screen, because there isn't one.** Seven tabs are
reachable only by typing a URL, and the roster links to a route that does not
exist. Open question 6. Nothing is wrong with the tabs; there is no way to
click to them.

**4. The AI jobs.** Every one of them ships as generate-a-prompt plus
paste-the-result behind `AI_PROVIDER=off`, as instructed. The prompts are
built and the paste path is tested, but no model has ever been on the other
end of one, so nothing is known about whether the drafts are any good. The
split holds regardless: nothing in `derived` is ever written by a paste, so a
model cannot change which movements a client with a spinal fusion is allowed
to do.

**5. Reminders and messages at real volume.** The dispatchers are idempotent by
construction and the planners are pure and tested, but nothing has run on a
scheduler for a week. The failure mode to watch for is the one nobody sees: a
reminder that silently does not send.

**6. The quarter-hour timezone search.** India and Nepal are handled, and
tested, but only synthetically. No real client has a +5:45 clock here.

**7. The `--watch` amber.** It fails the lightness band of the dataviz
validator and passes everything that decides whether the colours can be told
apart. It is a locked DESIGN.md Part 2 value, so it is Darren's call, not mine.
Open question 5.

---

## docs/OPEN_QUESTIONS.md, in full

# Open questions

Things the build is waiting on, and decisions that need Darren rather than a
default. Written as work happens, per standing rule 13: a blocked item goes here
and the run continues rather than stalling.

---

## 1. The 11 auth tests cannot be proved in the build container

**Item:** 0
**Status:** blocked on hardware, not on code
**Needs:** a run on Darren's Mac

The Docker daemon does start in this container. Images cannot be pulled: every
registry serves its blobs from a CDN the network policy refuses.

```
$ docker pull supabase/gotrue:v2.158.1
production.cloudfront.docker.com/...: Forbidden

$ docker pull public.ecr.aws/supabase/postgres:15.8.1.060
d2glxqk2uabbnd.cloudfront.net/...: Forbidden
```

The agent proxy records the denial by host, so this is a policy decision rather
than a transient failure. No GoTrue means no real auth, so the 11 auth tests
fail here by design (a guard that cannot run is a failure, never a skip) and the
75 non-auth tests are the whole of what this container can prove.

**What Darren runs:**

```sh
npm test && npm run test:e2e     # expect: AUTH COVERAGE: all 11 auth tests ran and passed
```

Then the wrong-host control in `docs/LOCAL_VS_PRODUCTION.md`, which should turn
both client magic link tests red and nothing else.

---

## 2. Exercise library import has no source files

**Item:** 4
**Status:** blocked on files only Darren has
**Needs:** the eight v1 client `index.html` files

`scripts/import-exercises.ts` and its parser are built and unit tested against
fixtures. Nothing is seeded, on instruction: no placeholder exercises. Every
later item that needs a real movement name reads from whatever the library
holds, so it degrades to an empty library rather than to wrong data.

**What Darren runs, once the files are in a directory:**

```sh
npm run exercises:import -- <dir>
```

---

## 3. Which media licence the exercise library buys

**Item:** 4, Phase 2 of Part 8 in the spec
**Status:** decision, not a blocker
**Needs:** Darren to pick one

Part 8 lists ExerciseDB, MuscleWiki and ExerciseAnimatic. All are paid, and
standing rule 12 is no paid APIs, so nothing has been signed up for. The schema
keeps `media.gif_url` and `media.video_url` empty and renders from
`media.youtube_id`, so the choice can be made later without a migration.

---

## 4. The intake wording came from the spec, not from the blueprint document

**Item:** 10
**Status:** built, but from a derived source
**Needs:** Darren to read it, or to send the original

Item 10 asks for "the intake form from sections 1 to 10 of the blueprint
document". That document was not supplied to this build, so the ten sections in
`src/lib/questionnaire/intake.ts` are derived from Part 4.6 and Part 5 of the
portal spec, which between them enumerate every field the Blueprint has to
carry.

Every question was written to be read by something: the template applier reads
the injury flags, the calorie path reads the nutrition structure, the question
bank filters on the goal type, the trigger presets read the step goal and the
failure mode. A test asserts every question names at least one variable it can
change, so a question nothing reads cannot be added quietly.

If the original document words things differently, `intake.ts` is the one file
to change. The keys are what everything downstream reads, so changing a key is
the change to be careful with; changing the words in front of it is free.

---

## 5. The watch amber sits outside the lightness band for a dark surface

**Item:** 20
**Status:** a decision, not a blocker
**Needs:** Darren to say whether to move it

The progress charts were built with the dataviz method, which says to compute
the color checks rather than eyeball them. Running its validator over the three
signal colors against the panel surface:

```
$ node validate_palette.js "#4E9E6A,#C9A227,#C04A38" --mode dark --surface "#16181A"
  [FAIL] Lightness band      outside band: #C9A227 at 0.728
  [PASS] Chroma floor        all 3 above the floor
  [PASS] CVD separation      worst pair ΔE 9.3 protan, 19.7 tritan
  [PASS] Normal-vision floor worst pair ΔE 16.3
  [PASS] Contrast vs surface all 3 at or above 3:1
```

Everything that decides whether the colors can be told apart passes, including
under color vision deficiency, and by a comfortable margin: the target is 8 and
the worst pair is 9.3. What fails is the lightness band, which is about keeping
marks at a consistent weight so no one series shouts. `--watch` at 0.728 is
brighter than the other two.

**Not changed, because `--watch` is a locked value in DESIGN.md Part 2,** and
the standing rules say no new color meanings without amending that first.
Changing a value is close enough to the same thing that it is Darren's call
rather than mine. The desaturation was also deliberate: "a screen showing eight
clients will often carry all three at once, and saturated versions turn the
roster into a Christmas tree."

Nothing in the build depends on the answer. Status color never carries a meaning
on its own anywhere in the portal: `bandLabel()` gives every band a word, and the
chart delta says "up" or "down" in text beside the color. A test holds that line.

If it is worth moving, the nearest passing step is a slightly deeper amber, and
the two places to change it are `src/styles/tokens.css` and DESIGN.md Part 2.

---

## 6. There is no client detail screen, so seven tabs are reachable only by URL

**Item:** 23, but it applies to 7, 8, 20 and 21 equally
**Status:** needs a decision about scope, not a blocker

Spec Part 4 describes a client detail screen with a top strip (name, age, sex,
goal statement, program name, Day X of N, phase chip, race countdown if any,
start date, end date) and a set of tabs under it. That screen is not in the
numbered item list 0 to 23, and nothing built so far creates it.

The consequence is concrete. The roster links each row to
`/coach/clients/<slug>`, and that route does not exist. The seven screens that
do exist live under it:

```
/coach/clients/<slug>/blueprint
/coach/clients/<slug>/checkins
/coach/clients/<slug>/nutrition
/coach/clients/<slug>/photos
/coach/clients/<slug>/program
/coach/clients/<slug>/progress
/coach/clients/<slug>/race
```

Every one of them renders correctly and every one is covered by tests. None of
them can be reached by clicking. Race mode is the seventh, and it is where this
stopped being ignorable, because the race countdown is one of the things the
spec puts in the top strip.

**Not built, because it is a screen the item list does not ask for** and
standing rule 10 says to note it rather than add it. It is a small screen: the
top strip is facts already being read on other tabs, and the tab bar is a list
of seven links.

What it needs from Darren is only the decision to spend an item on it.

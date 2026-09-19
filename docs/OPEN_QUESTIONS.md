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

**Item:** 4, and item 26 which is waiting on it
**Status:** still blocked on files only Darren has
**Needs:** the eight v1 client `index.html` files, in `v1-archive/`

Checked again on 2026-09-19 for item 26: `v1-archive/` does not exist in the
repository or on the branch, and there is no `index.html` anywhere in the tree.
Item 26 is skipped rather than worked around, per standing rule 13.

When the files land, item 26 is three commands and a screen:

```sh
npm run exercises:import -- v1-archive
```

then the unmatched review screen in the Builder, then re-running the spine
assertion against the real library instead of `tests/fixtures/program.ts`. The
last part is the one that matters: that assertion is only as good as the library
it filters, and today it filters a fixture with one barbell back squat in it.

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

**Item:** 20, answered in 27
**Status:** SETTLED. Darren's call, 2026-09-19: it stays as committed.

`--watch` at #C9A227 fails the dataviz validator's lightness band and passes
every check that decides whether the colors can be told apart. It is a state
signal rather than a chart color, and a drifting row is supposed to catch the
eye before an on-plan one, so equal optical weight is the wrong goal for the
job it does.

The reasoning is now written into DESIGN.md Part 2, beside the value, so the
next person to run a palette validator over these three finds the answer there
rather than reopening it.

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

---

## 7. A reminder has no lateness cutoff

**Item:** 25 found it; it belongs to 16
**Status:** a product decision, not a blocker

`planReminders` sends anything whose time has come round today and has not
already gone out. There is no upper bound, so a dispatcher that was down all
morning delivers "Here is today." at four in the afternoon, and one that was
down all day delivers it at 23:50.

Catching up is deliberate and stated in item 16: "a tick that has been down all
morning catches up without five separate pings." What is not stated is how late
is too late. The message dispatcher does have a cutoff and holds anything hours
old rather than waking a client with yesterday's nudge; the reminder planner has
nothing equivalent.

**Not changed, because it changes when clients get messages,** which is Darren's
call rather than mine. The fix is one filter in `planReminders` and a constant
beside `DIGEST_WINDOW_MINUTES`.

The question is just the number. Two hours would mean a 07:00 reminder is dead
by 09:00; four would carry it to lunchtime.

---

## 8. `question_bank` is seeded and nothing reads it

**Item:** 25
**Status:** dead weight, safe to leave, worth a decision

The seed fills a `question_bank` table with about twenty questions. Nothing in
`src/` queries it. Every screen that renders a check-in reads
`src/lib/checkin/bank.ts` instead, which holds the same questions under
different keys.

That divergence caused a real defect, now fixed: the seed wrote its own table's
keys into `checkin_forms.questions`, so all eight synthetic clients had check-in
forms whose questions resolved to nothing on every screen.
`tests/unit/checkin-bank.test.ts` now holds the seed's keys against the module.

The table is harmless where it is, but it is a second source of truth sitting
next to the first. Either the Builder's question bank screen should read it, or
it should go.

---

## 9. Four status lines take a signal color on prose

**Item:** v2 step 5 found them
**Status:** a judgment call about scope, not a bug

DESIGN_V2.md 2.3 says color appears only as a signal state on a figure that has
a defined threshold. Four places put a signal color on a sentence instead:

```
src/components/photos/PhotoGrid.tsx      a week with fewer than three angles
src/components/messages/Composer.tsx     a quick reply with no matching template
src/components/nutrition/RegeneratePath.tsx  regenerating will overwrite edits
src/components/checkin/SubmissionList.tsx    a submission waiting for review
```

Each is a real warning a coach should read, and none is a figure. They are not
changed here because the honest fix is not obvious: dropping the color makes
four genuine warnings quieter, and keeping it spends signal on prose in four
more places than the spec allows.

The options are to give warnings their own treatment that is not one of the
three signals, which is a small addition to Section 3, or to accept these four
as a stated exception the way the contraindication amendment already is.

Nothing depends on the answer. All four say what they mean in words.

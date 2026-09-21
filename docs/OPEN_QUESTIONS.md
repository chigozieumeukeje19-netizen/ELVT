# Open questions

## BLOCKED ON A DECISION: the coach and the client are the same Postgres role

**Item:** 38.1
**Status:** half the audit cannot ship until this is answered

The coach portal builds its Supabase client from the anon key plus the coach's
GoTrue session (`src/lib/supabase/server.ts`, used by 26 files). A GoTrue
session is the Postgres role `authenticated`. The client API mints its own
token and also claims `authenticated`. What tells a coach from a client is an
RLS policy calling `is_staff()`, which is a row-level test.

Column privileges are per role, so they cannot tell two users of the same role
apart. Revoking UPDATE on `checkin_submissions.review_note` from
`authenticated` takes it from the coach too, and the coach's check-in review is
the thing that writes it. Run rather than reasoned: the coach's update came
back `permission denied for table checkin_submissions`.

So the shipped migration does the part that is pure gain -- anon writes
nothing anywhere, and the columns neither a coach nor a client writes are gone
from `authenticated`. `review_note`, `reviewed_at`, `thread_id`,
`sessions.coach_notes`, `messages.scheduled_for`, `messages.touchpoint` and
every coach-only column on `clients` are still writable by any client holding a
valid token, because there is no way to take them from the client without
taking them from the coach.

Three ways out, with a recommendation:

1. **A custom access token hook, so staff get their own role.** Supabase runs a
   Postgres function over the JWT claims at issue time. It sets `role` to
   `staff` when `profiles.role` is coach or admin. Then `authenticated` means
   client, the audit's column lists apply cleanly, and the coach policies
   retarget from `to authenticated` to `to staff`. **Recommended.** It is the
   only one that closes the hole for a client signed into the portal as well
   as one coming through the API, and it makes every future column grant
   meaningful rather than a negotiation.
   Cost: a new role, a hook function, retargeting the policies on 53 tables,
   and the shim has to carry the role. Estimate half a day, most of it
   mechanical and testable locally.

2. **Mint the client API token with its own role.** We already sign that token
   ourselves, so `role: "client_app"` costs almost nothing. It closes the API
   path and leaves the portal path open, because a client signing in at
   `/client/today` still gets `authenticated` from GoTrue. Half a fix, and the
   half it leaves open is the one a person could find by hand.

3. **Move coach writes to the service role.** Rejected. It takes RLS out of the
   coach path entirely and puts every `client_id` filter back into application
   code, which is exactly where item 25 found five missing filters.

Nothing is live, so nothing is at risk today. This should be settled before the
first real client.

---

## The client API has almost no test that a call succeeds

**Item:** the question raised after item 38.3
**Status:** a gap worth a round of its own

`POST /api/v1/habit-log` shipped having never worked once. It upserted a body
with no `client_id` into a `NOT NULL` column, and the failure went into the
same branch as a missing row, so it answered 404 and said nothing.

The honest count of what covered it:

| Suite | What it proves | Count |
| --- | --- | --- |
| `tests/sql/api_rls_checks.sql` | a client cannot reach another client's row | 30 assertions, **29 of them refusals** |
| the one exception | `POST /photos writes into the client` | 1, and at the SQL layer, not through the route |
| `tests/integration/*` | the persistence functions behind the jobs read the right rows | 50, none of them a route |
| `tests/unit/api.test.ts` | routes cannot bypass RLS, structurally | source reading, no execution |
| `tests/e2e/client-app.spec.ts` | the PWA's behaviour | **mocks `/api/v1/**` with a stubbed 200** |

So before this round: **zero of the 32 endpoints had a test that called the
handler and then looked at the table.** A rejection test cannot see an endpoint
that rejects everything, which is precisely what happened.

`tests/integration/client-api.test.ts` now covers four of them, because four
had defects. The other 28 are still unproven in that sense.

Estimate: a day. The harness exists now -- real PostgREST, a real signed token,
the route module imported and called -- so each endpoint is roughly ten lines:
arrange the fixture, call, read the row back. The fixtures are the slow part,
since the program chain is programs to weeks to days to sessions to sections to
exercises. Worth doing as one pass rather than drip fed, and worth doing before
a real client rather than after.

---

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

---

## 10. There is no top bar, so the theme toggle sits in the sidebar

**Item:** v2 steps 1 to 4
**Status:** a deliberate deviation from DESIGN_V2.md 3.1, pending a decision

3.1 specifies a 52px top bar carrying a breadcrumb, a search field, the theme
toggle and the coach avatar. The portal has none: v1 decided against one on the
grounds that a second chrome band costs rows the roster needs, and that decision
survived into the retint because the density assertion did not move.

The theme toggle is the part that could not wait, because light mode is
unreachable without it and step 7 requires every screen to be checked in both.
It is in the sidebar footer next to sign out, where it costs no vertical space
in the content area.

The arithmetic, measured rather than estimated: a roster row is 48px and 14 of
them plus the page header and the table head currently land inside 900px with
room to spare. A 52px top bar does not obviously break that, but it has not been
built and so has not been measured.

The question is whether the top bar is wanted at all. Search and the avatar have
nowhere else to go, which argues for it; the roster and the queue are the two
screens that run full width precisely because density buys columns, which argues
against. If it is built, the toggle moves to it.

---

## 11. Calendar and Library are in the spec and not in the build

**Item:** the /coach/settings 404
**Status:** removed from the nav, waiting on a decision about whether to build

The sidebar carried three links to pages that did not exist: Calendar, Library
and Settings. All three returned a 404 from the persistent chrome on every coach
screen.

Settings is built, because there was something real to put on it: who you are
signed in as, the theme preference, and a straight answer about where the
settings that are not there live.

Calendar and Library had nothing to put on them that is not already somewhere
else, so they are out of the nav rather than stubbed. A stub page that says
"coming soon" is a 404 with better manners.

`tests/unit/nav.test.ts` now fails on any dead internal link in `src/`, not just
these, so this cannot happen quietly again.

The question is whether either is wanted. The Builder already holds the exercise
library and the question bank, which is most of what a Library screen would be.
A Calendar has no equivalent: the week strip and the day grid are per client,
and nothing in the portal shows a coach their whole week at once.

---

## 12. Nothing runs the four scheduled jobs

**Item:** 30, the deploy dry run
**Status:** the one thing standing between this build and a deploy

`npm run deploy:dry-run` reports it every time. The week roll, the nightly
triggers, the reminder dispatcher and the message dispatcher are npm scripts
that tick every few minutes, and no scheduler runs any of them. Without one:
adherence is never computed, no trigger ever fires, no client is reminded of
anything, and scheduled messages are written and never sent.

The options and their costs are in docs/DEPLOY.md. Choosing between GitHub
Actions cron, Netlify scheduled functions and Supabase `pg_cron` is a cost
decision rather than a technical one, which is why nothing here picks it.

All four are idempotent by construction and tolerate a late tick, so the
scheduler does not have to be precise. It does have to fail loudly when its
credentials are missing: a job that exits zero because it had no key is a day
where no client was reminded and nothing said so.

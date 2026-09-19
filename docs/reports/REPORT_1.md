# Report 1: items 0, 8 and 9

Covers the client magic link, the calorie path generator with the nutrition
tab, and the week roll job.

## Gate at this point

```
npm test          14 files, 213 tests, all passing
design audit      0 high, 0 medium, vibe score 100
typecheck         clean
npm run test:e2e  100 passing, 11 auth tests FAILING here (no GoTrue, see below)
```

The 100 includes 78 visual assertions across both viewports.

---

## Item 0. Client magic link

**Built.** `src/lib/auth/link-errors.ts` classifies what GoTrue said when a
link request is refused, and the client login page renders it.

The defect was the confirmation screen. Once "Check your email" was up there
was no resend control and no error slot, so a client whose link never arrived
had only the browser's back button, and a refusal on the way back had nothing
to render into. GoTrue rate limits per address, so the request right after a
burst is exactly the one that gets refused, and it was refused silently.

**What the tests prove.** Seven cases. The per-address limit names its wait
inside the message text and nowhere else, so the number is read back out and
counted down in front of the client. The hourly send limit is a wait with no
number, so no countdown is promised. A rejected redirect host is not a rate
limit and never offers one, because waiting does not fix it. Anything
unrecognised keeps GoTrue's own words rather than being flattened into a
friendlier sentence that hides it.

**Control.** Removing the rate limit branch turns three of the seven red and
leaves four green.

**Not done, and why.** `AUTH COVERAGE: all 11 auth tests ran and passed`
cannot be produced in this container. The Docker daemon starts; no image can
be pulled, because every registry serves its blobs from a CDN the network
policy refuses, and the proxy records the denial by host. See open question 1.
The wrong-host control is written down as a runnable command block in
`docs/LOCAL_VS_PRODUCTION.md`.

---

## Item 8. Calorie path generator and nutrition tab

**Built.** `src/lib/nutrition/{calorie-path,meals,grocery}.ts`, the coach
nutrition tab, and seven preview routes.

Four shapes. Linear; front loaded, an ease out that takes most of the cut
while adherence is highest; rising, its mirror, for a gaining client; and
mileage linked, where a week that runs further sits nearer the start of the
path because the deficit is already being paid in miles. The mileage bend goes
through a bell that is zero at both ends, so running moves the middle of the
block and never its goal state.

**What the tests prove.** Each of the eight rules the item names has a test,
and each was seen red:

| Rule | Control | Red |
| --- | --- | --- |
| Protein identical in every week | scale it with calories | 3 |
| Deload carries the previous week's number | let it step | 1 |
| Final week equals the goal state exactly | 99 percent of it | 3 |
| Carbs and fat absorb the entire reduction | covered by the above | |
| Macros sum to the calories exactly | round them independently | 4 |
| Meals sum to the day target, last absorbs rounding | round every meal | 2 |
| Editing a week leaves later weeks alone | always re-ramp | 1 |
| Day override is base plus per mile | ignore the per mile | 1 |
| Grocery quantities scale with the week | stop scaling | 1 |

Where rule 2 and rule 3 collide, which happens when the last week is marked
deload, rule 3 wins and the row says so. A deload final week is a programming
choice; silently missing the goal state is not.

**Two real defects the tests caught.**

1. The mileage shape read its miles by ramp position rather than by week
   number, so every week after the first deload was fed the wrong week's
   running. Nothing about the output looked wrong. The test comparing a 34
   mile week against an 18 mile week found it.
2. The seven column path table ran 730px wide on a 390px phone with no way to
   reach the rest of it. It has its own horizontal scroller now, rather than
   columns squeezed until the numbers stop being readable.

**Worth knowing.** Integer grams cannot hit every calorie total at a fixed
split, because 4 and 9 do not divide every remainder. Rather than let a few
calories drift into the number the client reads, fat walks away from its ideal
until the carbohydrate remainder divides by 4. Nine mod four is one, so every
fourth step lands, and a test holds the walk to within 3g across two thousand
calorie levels.

**One control that did not bite first time.** An induced clip landed on a
table cell that already truncates with an ellipsis, which the clip detector
allows on purpose. Re-run against an element with no ellipsis it failed as it
should. Reported because a control reported as passing when it was never
exercised is worse than no control.

---

## Item 9. Week roll job

**Built.** `src/lib/engine/{clock,scoring,week-roll,run-week-roll}.ts`,
`scripts/week-roll.ts`, `npm run week:roll`.

Sunday 23:59 in the client's own timezone. Split in two on purpose:
`planWeekRoll` is a pure function from a bundle of rows to a list of writes,
and `run-week-roll.ts` applies them. Everything that can be wrong about a week
roll is arithmetic or a timezone, and neither needs a database to be proved.

**What the tests prove.** 33 tests. The timezone ones all pick an instant
where the server's date and the client's date disagree, because that is the
only case where a wrong implementation is visible: 02:30 UTC on Monday the
21st is still Sunday the 20th in New York and already Monday in Kabul. Rolling
at that instant produces a full plan for the New York client and nothing at
all for the Kabul one.

Idempotency is by construction. Every write carries a key, the keys already
present are read back before planning, and a key that exists is skipped. A
frozen snapshot stops the whole roll. In the persistence half the snapshot
update is guarded by `is("snapshot", null)` and the form insert tolerates
23505, so two schedulers racing end with one doing nothing rather than both
succeeding.

**Controls, all seen red.**

| Control | Red |
| --- | --- |
| Roll on the server's clock | 12 |
| Score a rest day out of a fixed 100 | 2 |
| Count a category with nothing planned as zero | 1 |
| Count the streak by arrival order | 1 |
| Roll a week that is already frozen | 1 |
| Write next week's forms without checking what exists | 1 |
| Ignore the event and queue keys | 1 |
| Compare the mileage ramp against one week not three | 1 |

**Two controls did not bite first time, and both were gaps in my tests.** The
streak test fed days already in date order, so removing the sort changed
nothing; it now interleaves them the way a client who logs Tuesday's session
on Wednesday morning actually does. The idempotency test froze the snapshot as
well as supplying the keys, so the snapshot check short-circuited before the
form check was reached; there are now two tests for the case those keys exist
for, a run that died halfway with three dailies left to write.

**One real defect found while writing them.** `isDue` checked the weekday
before it parsed the schedule time, so a malformed schedule was silently
ignored on six days out of seven and only threw on the seventh. Parsed first
now.

**The design audit caught me.** Two band thresholds written as literals in the
queue severity. Fixed with `bandFor`, the one place that knows 85 and 60, so a
card that sorts to the top of the queue is the same client whose roster row is
red. Not exempted.

---

## Open questions at this point

Full text in `docs/OPEN_QUESTIONS.md`.

1. **The 11 auth tests cannot be proved in this container.** Docker starts, no
   images pull, policy denial recorded by host. Blocked on a run on the Mac.
2. **Exercise library import has no source files.** Parser and script built and
   unit tested against fixtures. Nothing seeded, on instruction.
3. **Which media licence the exercise library buys.** A decision, not a
   blocker. Schema keeps the fields empty and renders from YouTube ids.

## What I would not yet trust with a real client

The week roll's database half. Its arithmetic is covered thoroughly and its
persistence is not: `buildRollInput` and `applyPlan` have no test that runs
them against real rows, because the adherence counts read five tables and this
container cannot start PostgREST. The planner is right; whether the numbers
handed to it are the right numbers is unproven.

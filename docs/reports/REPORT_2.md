# Report 2: items 10 to 16

Intake, blueprint, check-ins, triggers, the Monday card, messaging, reminders.

## Gate at this point

```
npm test          22 files, 421 tests, all passing
design audit      0 high, 0 medium, vibe score 100
typecheck         clean
npm run test:e2e  220 visual passing, 11 auth tests FAILING here (no GoTrue)
```

Fifty-one controls have been run across these seven items, each one breaking a
rule deliberately and confirming the tests go red before restoring. Five of
them did not bite on the first attempt; all five were gaps in my tests rather
than in the code, and all five are named below.

---

## Item 10. Intake questionnaire

Ten sections, all eleven question types. Three of those types are not just
data: a metric answer writes a `daily_logs` column so the weight typed into the
intake is on the chart the same day, a progress photo answer writes to the
gallery, and a signature is kept and never rendered where a coach browses.

The metric target is a closed list. A questionnaire pointing one at a column
nobody allowed is dropped from the writes and kept in the blob, because the
answers arrive from a public endpoint and "the questionnaire said so" is not
authorisation.

Every question names at least one client variable it can change, and a test
holds that line. A question that changes nothing costs a client a minute every
week and moves nothing.

**Controls:** 7, all red. **Real defects found:** the Builder nav ran past a
390px viewport once it had a fourth tab; the signature control was a native
13px checkbox. **Control that missed:** the star rating one, because the intake
pinned min and max on the question so the default was never exercised.

## Item 11. Blueprint drafter and approval

The Blueprint is split in two, and the split is the design. The derived half is
computed from the intake by code: goal, duration, days, equipment, targets, and
the injury flags. The drafted half is the prose. Only the drafted half goes
through the prompt and paste flow, so no AI job can change which movements a
client with a spinal fusion is allowed to do.

Approving writes a new version rather than overwriting, because a program
written in week 1 has to stay explicable in week 9. It is also the only place
flags reach `clients.flag_config`.

**Controls:** 8, all red. **Real defect found by probing rather than by a
test:** a movement removed because of a spine flag was explained as "not
available with this equipment". The applier's reason was a sentence and the
explainer matched it against the token "injury", so it always fell through to
the equipment branch. Substitutions now carry a structured cause set at the
source.

The design audit caught the voice checker's list of banned phrases as banned
phrases. Right finding on a duplicate, wrong one on a ban list, so the two
lists are now one file that both read. **Control that missed twice:** the test
for that merge looped over the list it was checking, so removing a phrase could
never fail it. It names them now.

## Item 12. Check-in engine

Every question names its category, who it applies to by goal and by flag, and
which client variable its answer can change. The third is what makes the spine
work: whichever variable changed last Monday, the weekly pulls the questions
whose `produces` matches it.

Daily is six to seven questions, opening with the same four for everyone.
Nothing on it takes a minute to answer. Weekly is about fifteen in a fixed
order, fasted weight first, spine questions straight after the shared block,
accountability and the one thing last. Week 1 carries the fit section.

**Controls:** 9, all red.

**A real bug, and a new standing guard because of it.** The review wrote a
`messages` row without `client_id`, which is not null and is what the RLS
policy for the client role reads. It typechecked and it built, because the
Supabase client is untyped here, and it would have failed the first time a
coach reviewed a check-in. `tests/unit/inserts.test.ts` now reads the required
columns out of the live schema and every insert out of the source, and names
any that disagree. **That guard took two attempts:** the first parser matched
forward from `.from` to the next `.insert`, which pairs the earliest from in
range with an insert further down. It found five inserts in a file with seven
and reported everything as fine.

## Item 13. Trigger engine and retention scan

21:00 in the client's own evening. Thresholds are each client's own, since a
step threshold at a round 10,000 fires every night for someone who walks 7,400
and never for someone who walks 15,000. Two consecutive days, not one. A
missing reading is missing, not a zero.

Four retention checks: 72 hours quiet, two missed sessions, three days with no
food, three skipped check-ins. A rest day is not a miss. A client who never
started gets a different message from one who went quiet.

The queue now runs in the three decision lanes rather than one severity list. A
flat list hides which rule an item falls under, and those rules are what tell
the coach whether to act today, act Monday, or reply. The rule about what is
*not* in the queue has its own test: a single bad week with no flag and no
trend produces nothing.

**Controls:** 9, all red.

## Item 14. The Monday card

Everything needed to decide, on one card, in reading order. Each proposed
change is accept, edit or reject on its own, because a coach who has to take
all three or none will take all three. An edited line records as `ai_edited`
rather than `ai_accepted`, which is the only way to tell later whether the
drafting is any good.

**Two design rules were met by changing the card, not the rule.** The card ran
988px against a 900px viewport. Measured rather than guessed: the five
adherence rows at the 44px row height were 220px on their own and set the whole
card's height. They are five figures across now. The page header cost another
135px stacked, so the count sits beside its label. The card is 642px and the
next one starts at 771.

Accept All writes five things in a fixed order. Supabase has no interactive
transaction over PostgREST, so the order carries the weight: the plan first and
the message last, because a client with a new plan and no message is behind on
information, while one who gets a message about a plan that did not save is
being lied to.

**Controls:** 8, all red.

## Item 15. Messaging

The inbox does not sort by most recent. The thread at the top of a recency list
is the client you are already talking to; the one who needs a message is the
one who has sent you nothing. That ordering is the retention mechanic, so it is
the default, and it ignores how well the client is doing on purpose.

Touchpoints count Monday to Sunday, not a rolling week, so the roster column
means the same thing every day. A scheduled message is not a touchpoint until
it has gone. A client's reply is never one.

Quick replies fill from the client's own figures and name a missing value
rather than leaving a hole or blanking it to zero.

**Controls:** 9, all red. **Real bug the tests found:** the local time to
instant search only tried whole hour offsets, so India at UTC+5:30 and Nepal at
UTC+5:45 never resolved. Quarter hours now.

## Item 16. Reminders

Ten kinds, each on the client's clock. Anything within an hour of something
else goes out as one message. The window is measured from the first in a group
rather than the last: measured from the last, 07:00, 07:50 and 08:40 chain into
one endless digest and the last arrives an hour and forty late.

Nothing nags. A client who logged their steps at ten gets no steps reminder at
two.

**Controls:** 9, all red. **Real hole the tests found:** a single reminder with
a malformed time went through silently, because a one element array never calls
its sort comparator and the comparator was the only thing validating the time.

---

## Open questions

Unchanged from Report 1 apart from one addition. Full text in
`docs/OPEN_QUESTIONS.md`.

1. **The 11 auth tests cannot be proved in this container.** Docker starts, no
   images pull, policy denial recorded by host.
2. **Exercise library import has no source files.**
3. **Which media licence the exercise library buys.**
4. **The intake wording came from the spec, not from the blueprint document.**
   Darren's document was not supplied, so the ten sections are derived from
   Part 4.6 and Part 5, which between them enumerate every Blueprint field.

## What I would not yet trust with a real client

**The jobs' database halves.** Five jobs now have the same shape: a pure
planner with thorough tests, and a persistence layer with none. `buildRollInput`,
`buildInput` for triggers, `loadReviewCards` and both dispatchers read between
three and six tables each and have no test that runs them against real rows,
because this container cannot start PostgREST. The arithmetic is right. Whether
the numbers handed to it are the right numbers is unproven, and that is the
single largest gap in the build.

**Push delivery.** The reminder dispatcher writes a `reminder_sent` event and
stops there. Nothing actually sends a push, because that needs a paid service.
The digest logic in front of it is complete and tested.

**The AI drafting itself.** Every job ships as a prompt and a paste box, and the
paste is parsed strictly and checked against the voice rules. What no test can
tell you is whether the prompts produce good coaching. That needs Darren reading
a few real outputs.

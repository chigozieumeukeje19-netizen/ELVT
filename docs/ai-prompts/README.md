# AI prompt review pack

One file per AI job. Each carries the prompt the portal generates, a response
that gets through the parser, and the errors the parser gives back when one
does not. Paste a prompt into Claude, read what comes out, and decide whether
the drafting is worth turning on.

Regenerate with `npm run ai:pack`. Do not edit these by hand: the whole point
is that the prompt in the file is the one the portal sends.

## The jobs that go through a model

- [Blueprint drafter](blueprint-drafter.md) — Turns the intake into the prose half of a Blueprint: the summary a coach reads before a call, the One Thing, the failure mode and the tone.
- [Program drafter](program-drafter.md) — Writes one line per week explaining what that week is for. The program itself is built by code from the template and the client's flags, so this explains it rather than designing it.
- [Weekly review drafter](weekly-review.md) — Drafts the Monday card: what to change, why, and the message to the client. The coach accepts, edits or rejects every line.

## The jobs the spec lists that do not

Part 7 of the spec names seven AI jobs. Four of them are done by code instead,
and each one is deliberate rather than unfinished:

- **Calorie path proposer.** `generateCaloriePath` computes every week from a
  start point, an end point and the deload weeks, and week twelve equals the
  goal state by construction. A model would produce a plausible curve that does
  not land on the number.
- **Trigger message drafter.** The suggested message is stored on the trigger
  when it is proposed from the client's own numbers, so it is ready before the
  trigger ever fires. Drafting it at 21:00 would put a model call between a
  fired trigger and the queue.
- **Form generator.** The weekly form is built from the spine variable by
  `buildWeeklyForm`, picking the bank questions whose `produces` matches what
  changed last Monday. That is a lookup, not a judgement.
- **Check-in summarizer.** Not built. The Monday card shows the answers with
  the spine question pinned to the top, which is what a coach reads anyway on
  a form of fifteen questions.

## AI_PROVIDER is off

Every one of these ships as a copyable prompt plus a paste box. Nothing in the
portal reaches a paid endpoint, and nothing will until `AI_PROVIDER` names a
real provider.

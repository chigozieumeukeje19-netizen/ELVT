# LIBRARY SPEC: item 26, unblocked

The v1 client app files are recovered and committed under `v1-archive/`. This unblocks the exercise library import and, more importantly, turns the spine safety assertion from a fixture test into a real one.

Read `v1-archive/INVENTORY.md` first. It tells you exactly what is in there and where the parser's assumptions will meet reality.

---

## WHAT IS IN THE ARCHIVE

```
v1-archive/
  current/    8 apps, the active roster as of 20 Sep 2026
  retired/    3 apps, clients no longer active, kept for exercise coverage only
  audits/     the legacy audit scripts (audit1, audit2, audit4, constraints, verify, realdom)
  INVENTORY.md
```

Eleven apps, and they are NOT one format. Three shapes:

1. **YouTube shape**, 8 apps. Exercises are objects like `{n:'DB Flat Press', v:'-cpfMqSGxvg', wt:1, note:'...'}` and the app renders `youtube.com/watch?v=${i.video}`. This is what the parser was written against.
2. **ACE shape**, `current/cy.html` only. Exercises link to ACE Fitness library pages: `{n:'Seated Leg Press', url:A+'154/seated-leg-press/', src:'ACE'}` where `A` is the ACE base URL. 13 exercises. No YouTube id at all.
3. **Cue-only shape**, `current/stephanie.html`. Exercises carry a coaching cue and no media: `{n:'Trap bar deadlift', c:'Slow off the floor...'}`.

`current/kelsey.html` is nutrition led and has almost no exercise objects. Expect near zero from it.

**The numbers:** 119 unique exercise names with YouTube ids, 108 unique ids, 13 names that carry two different ids across apps, and 13 ACE linked exercises. Roughly 130 movements once ACE and cue-only names are merged in.

---

## 26.1 Extend the parser for the two shapes it was not built for

The parser was written against expectations and covered by fixture tests. It now has real input, and two of three shapes will not match.

- **ACE shape.** Capture the name and the full ACE URL. The exercises table's `media` jsonb already has room: store `{ace_url, source: 'ace'}` and leave `youtube_id` null. Do not drop these, they are the only verified links for that client's movements.
- **Cue-only shape.** Capture the name and the cue into `cues`. No media. These are real, coach-written movement names and belong in the library even without a video.
- Keep the fixture tests, but add one fixture per real shape taken verbatim from the archive, so the parser is proved against what actually exists rather than what was expected.

## 26.2 Run the import

`npm run exercises:import -- --dir v1-archive --dry-run` first. Report the counts. Then the real run.

Deduplicate by normalized name with the alias table. The archive has obvious variants that are the same movement written differently across apps and eras, for example "Seated Cable Row" and "Cable Row (Seated)", "Lat Pulldown" and "Seated Lat Pulldown", "Hip thrust" and "Hip Thrust". Merge where they are clearly the same movement, keep both spellings as aliases, and do not merge where the equipment differs.

## 26.3 The 13 conflicts go to the review screen, not to a coin flip

Thirteen names carry two different YouTube ids because different apps were built at different times. The full list is in INVENTORY.md.

Do not pick one silently. Load every conflict into the unmatched review screen with both ids side by side, and leave them for Darren to resolve. Where a movement has two ids, the more recent app's id is the better default suggestion, since every app went through a video verification pass and later passes caught earlier mistakes.

## 26.4 Contraindications and patterns are not in the archive, they have to be added

The v1 apps encoded safety as per-client constraints, not per-exercise flags. So the import gives you names and videos, and nothing about which movements are contraindicated for which flag.

That mapping is the whole point of the library. Populate `exercise_contraindications` for the imported movements using the flag keys the applier already understands (spine, knee, elbow, shoulder, rib, achilles), and set the movement pattern on each. Be conservative: a flag applied too widely costs a client an exercise, a flag missed costs them an injury. Where you are unsure, flag it and let the review screen surface it.

The legacy `audits/constraints.js` is worth reading here. It lists, per historical client, exactly which movements were forbidden and why, and that is the closest thing to a ground truth for which exercise excludes which flag.

## 26.5 Re-run the spine assertion against the real library

This is the reason the item matters.

The permanent assertion that a spine-flagged client receives no barbell back squat across all 84 days currently runs against a fixture. Point it at the real imported library and run the applier for the synthetic spine client. Then extend it: no barbell back squat, no conventional deadlift, no barbell squat of any kind, which is the actual constraint set the historical spine client was built under. Prove it bites by defeating the filter.

Do the same for the knee client (no walking lunge, leg press at moderate depth) and the elbow client (no barbell bench, all chest pressing dumbbell), drawing the constraint sets from `audits/constraints.js`.

## 26.6 Report

- Exercises and videos imported, by source (YouTube, ACE, cue-only)
- Merges made and aliases created
- The 13 conflicts, loaded into review, with the suggested default for each
- Contraindication counts by flag
- Any movement with no media at all
- The spine, knee and elbow assertions, run against the real library, seen to fail when defeated

---

## ALSO IN THE ARCHIVE, NOT PART OF THIS ITEM

`audits/` holds the six legacy audit scripts that the old client apps had to pass before delivery. The PWA exporter already claims to satisfy their rules. Run the generated app through the actual scripts, not a re-implementation, and report any divergence. If they pass, note it in the build log. If they do not, that is a defect in the exporter, since those rules came from real clients breaking real apps.

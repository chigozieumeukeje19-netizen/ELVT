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

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

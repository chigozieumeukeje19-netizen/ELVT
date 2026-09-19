# The review set

Every preview screen, in both themes, at both viewports. Regenerate with:

```
npm run review:shots
```

Four folders, one per theme and viewport, and the same file name in each, so a
screen can be compared across all four by opening the same name four times:

```
review/dark-1440x900/roster.png
review/dark-390x844/roster.png
review/light-1440x900/roster.png
review/light-390x844/roster.png
```

The images are full page, not viewport clipped, so a screen taller than the
fold is shown whole. Where density matters the measurement is in the visual
suite rather than in the picture: 14 roster rows inside the first 900px, and
the Monday card fitting with the next card's top edge visible.

Every person in them is invented. These render the same synthetic seed the
tests use, including the long names and the empty states, and no real client
data has ever been in this repository.

They are a snapshot of one commit, not a baseline. Nothing compares against
them and nothing fails if they are stale; they exist to be looked at. The
assertions live in `tests/e2e/visual.spec.ts`, which runs the same screens in
the same two themes at the same two viewports on every run.

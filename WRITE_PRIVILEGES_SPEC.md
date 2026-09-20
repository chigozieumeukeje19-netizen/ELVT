# WRITE PRIVILEGES SPEC: item 38

Two things surfaced from the v1 archives. One is a security gap that the
current schema very likely shares. The other is a media decision the library
import must respect.

## 38.1 Column-level write privileges

The gap. Postgres row-level security is row-level. A policy that lets a client
update a row they own lets them update every column on that row, including
columns that exist for the coach. Validation in the API layer is real but it is
one careless frontend edit away from a client overwriting coaching data, and
the API is not the only path once Base44 or a direct PostgREST call exists.

Where the shape exists now. Audit every table a client can write to, and for
each one list which columns the client role may write and which are coach or
server only. Known cases to start from:

* `checkin_submissions`: the client writes `answers` and `submitted_at`.
  `reviewed_at`, `review_note` and `thread_id` are the coach's.
* `clients`: the client may update display and preference fields.
  `flag_config`, `program_length_weeks`, `program_start_date`, `status`,
  `feature_flags`, `one_thing`, `coach_notes` and every target are not theirs.
* `set_logs`: the client writes `actual`. `prescribed` is written by the server
  at creation and never by the client.
* `program_weeks`, `program_days`, `sessions`, `session_exercises`, `runs`:
  clients should have SELECT only, plus the specific status and log fields the
  API exposes (session status, difficulty rating, customize text override).
  Nothing else.
* `daily_logs`, `meal_logs`, `habit_logs`, `run_logs`: the client's own fields
  only, and never `client_id` after insert.
* `messages`: a client may insert their own and mark read. They never edit
  `scheduled_for`, `touchpoint`, or another party's message.
* `plan_changes`, `queue_items`, `client_triggers`, `blueprints`, `audit_log`,
  `events`: no client write of any kind.

The fix. A migration that revokes UPDATE on each of those tables from
`authenticated`, then grants UPDATE on the explicit column list the client may
write. Same for INSERT where the API inserts on the client's behalf with
server-set columns. Do not weaken any RLS policy to do this, the two layers
stack.

Show me a table of table name, columns the client may write, columns only the
coach or server may write, so I can sanity check it before it goes in.

Prove it bites. From a client session, attempt to update `review_note` on their
own submission and `flag_config` on their own client row. Both must be refused
at the database, not at the API. Add both to the API RLS check suite
permanently.

## 38.2 ACE links are a second media type, not a fallback

The 13 ACE Fitness links in `v1-archive/current/cy.html` were a deliberate
choice, made after verifying that ACE's exercise library is step-by-step
instructions with photos rather than video. The reasoning: for a client with
gym anxiety, a page with numbered steps he reads before he walks in is better
than a video he scrubs through standing at a machine.

So the library must not treat these as exercises with missing video. Store them
as their own media type. The client surface renders an ACE link as a "How to do
it" page link that opens the ACE page, never as an embedded player and never
with a broken video placeholder. An exercise may carry both a YouTube id and an
ACE link, and the client surface should show both when both exist.

Add a test that an ACE-only exercise renders correctly in the exported PWA with
no video element and a working "How to do it" link.

## 38.3 Ordering

38.1 is a migration, so it goes in the same push as items 37 and 36. 38.2 is
part of the library import in item 26.

# What a client may write, column by column

The audit behind item 38.1, written down before the migration so it can be
checked. RLS is row-level: a policy that lets a client update a row they own
lets them update every column on that row. This is the column list that closes
that, and the two layers stack — nothing here weakens a policy.

The client API runs as `authenticated` with the caller's own JWT
(`src/lib/api/context.ts` builds its Supabase client from the anon key plus a
`Bearer` token), so these grants bite the API itself, not only a direct
PostgREST call. Getting the list wrong breaks the app, which is why every
column below is traced to the route that writes it.

## Two things settled, so nobody re-litigates them

**`clients` is already SELECT-only for a client.** The starting list assumed a
client may update display and preference fields on their own row. They cannot:
`clients` carries one client policy and it is SELECT. `flag_config` and every
target were never reachable. The grants still go in, because the two layers
stack and a policy added later must not silently re-open the row.

**The upsert key columns are safe, and only here.** They are marked **key**
below rather than folded quietly into the writable list, because at first
glance granting UPDATE on `client_id` looks like exactly the hole this closes.
It is not: every table that needs it carries an RLS
`with check (client_id = current_client_id())`, so a client can only ever set
those columns to values that are already theirs. Remove that policy and the key
grants stop being safe, which is why they are named here.

## A note on upsert keys

`POST /daily-log`, `/habit-log`, `/set-log`, `/day/<date>/task` and
`/checkin/<id>/submit` all use PostgREST upsert, which is
`insert … on conflict do update set <every column in the payload>`. Postgres
checks UPDATE privilege on each of those columns, so the conflict key columns
(`client_id`, `date`, `habit_id`, `form_id`, `for_date`, `session_exercise_id`,
`set_number`) need UPDATE even though nobody intends them to change.

That is safe here and only here: every one of these tables has an RLS
`with check (client_id = current_client_id())`, so a client can only ever set
those columns to values that are already theirs. They are marked **key** below
rather than quietly folded into the writable list.

## The tables

### Tables a client writes today

| Table | Client may INSERT | Client may UPDATE | Coach or server only |
| --- | --- | --- | --- |
| `checkin_submissions` | `form_id`, `client_id`, `for_date`, `answers`, `submitted_at` | `answers`, `submitted_at`, **key** `form_id`, `client_id`, `for_date` | `reviewed_at`, `review_note`, `thread_id` |
| `set_logs` | `session_exercise_id`, `client_id`, `set_number`, `prescribed`, `actual`, `logged_at`, `logged_for_date` | `actual`, `logged_at`, `logged_for_date`, **key** `session_exercise_id`, `set_number` | `prescribed` (server writes it once, at creation), `is_pr`, `pr_type`, `client_id` |
| `daily_logs` | `client_id`, `date`, `weight`, `steps`, `water`, `sleep_hours`, `energy`, `mood`, `session_status`, `custom` | same, **key** `client_id`, `date` | `readiness` (the engine computes it) |
| `meal_logs` | `client_id`, `date`, `meal_id`, `custom`, `source` | — (insert only today) | everything else |
| `habit_logs` | `client_id`, `habit_id`, `date`, `value`, `completed` | `value`, `completed`, **key** `habit_id`, `date`, `client_id` | — |
| `run_logs` | `run_id`, `client_id`, `distance`, `duration`, `avg_pace`, `avg_hr`, `max_hr`, `rpe`, `cadence`, `elevation`, `felt`, `stayed_in_zone`, `notes`, `source`, `logged_for_date` | same minus `run_id`, `client_id` | — |
| `day_completion` | `client_id`, `date`, `tasks`, `score`, `streak_after` | same, **key** `client_id`, `date` | — |
| `messages` | `thread_id`, `client_id`, `sender_id`, `body`, `kind`, `attachment_path`, `sent_at` | `read_at` **only** | `scheduled_for`, `touchpoint`, `body` and `kind` after insert, another party's row |
| `threads` | `client_id`, `subject` | nothing | — |
| `progress_photos` | `client_id`, `week_number`, `taken_on`, `angle`, `storage_path` | nothing | — |
| `questionnaire_responses` | `client_id`, `questionnaire_id`, `answers`, `submitted_at` | `answers`, `submitted_at` | — |
| `devices` | `client_id`, `push_token`, `platform` | `push_token`, `platform` | — |
| `sessions` | nothing | `status`, `started_at`, `completed_at`, `difficulty_rating`, `duration_min`, `fueling_notes`, `program_day_id` *(already granted, item 17)* | `coach_notes`, `kind`, `name`, `order`, `video_id`, `from_template` |
| `session_exercises` | nothing | `exercise_id`, `substituted_from_exercise_id` *(already granted, item 17)* | prescription, ordering, everything else |
| `program_days` | nothing | `calories_override`, `protein_override` *(already granted, item 17)* | everything else |

### Tables a client reads and must never write

`clients`, `program_weeks`, `runs`, `blueprints`, `plan_changes`,
`queue_items`, `client_triggers`, `audit_log`, `events`, `meals`, `habits`,
`exercises`, `checkin_forms`, and every other table in `public`.

`authenticated` currently holds table-level INSERT, UPDATE, DELETE and TRUNCATE
on all 53 tables, because Supabase grants that by default on every new table in
`public`. Only RLS stops a client deleting the audit log. The migration takes
the grants away too, so both layers say no.

## Three things the audit found that are defects, not hardening

These are live bugs in the client API, each of which the column grants would
have turned into a loud failure instead of a quiet one.

**1. `POST /api/v1/habit-log` cannot ever have worked.** It upserts the request
body, which is `{habit_id, date, value, completed}`. `habit_logs.client_id` is
`NOT NULL` with no default, so every call violates the not-null constraint, and
the route funnels the error into `notFound()` — so it answers 404 and says
nothing about why. It also never checks the habit belongs to the caller.

**2. `POST /api/v1/session/<id>/customize` writes `coach_notes: null`.** A
client customizing a session erases the coach's note on it. That is wrong on
its own terms, and the column is not in the grant list item 17 wrote, so the
write is already refused in a way nobody noticed.

**3. `POST /api/v1/device` updates `clients.communication_prefs`.** `clients`
has no client UPDATE policy at all, only SELECT, so device registration is
refused by RLS today. The spec assumed clients could update preference fields
on their own row; they cannot. Either the route moves to the `devices` table it
already has, or `clients` gains a narrow UPDATE policy plus a column grant. The
`devices` table is the better answer and is what the migration assumes.

**4. `POST /api/v1/set-log` re-writes `prescribed` on every upsert.** The value
is server-derived, so it is not a privilege hole today, but it means the column
needs UPDATE for the upsert to work, which is exactly what 38.1 says must not
be granted. The route changes to write `prescribed` only when the row is
created.

## What the migration will do

1. `revoke insert, update, delete, truncate on all tables in public from
   authenticated` — then grant back, by column, exactly the lists above. The
   table-level grants go as well as the column grants arriving: both layers say
   no, rather than RLS alone standing between a client and the audit log.
2. Leave every RLS policy untouched.
3. Leave `service_role` alone; the server jobs need it and it bypasses RLS by
   design.
4. Fix the four routes above, so the grants and the code agree.

## Proving it

From a client session, against the database rather than the API:

* `update checkin_submissions set review_note = '…'` on their own submission →
  refused
* `update clients set flag_config = '…'` on their own row → refused
* `update set_logs set prescribed = '…'` on their own set → refused
* `update messages set touchpoint = true` on their own message → refused
* `delete from audit_log` → refused

All five go into `tests/sql/api_rls_checks.sql` permanently.

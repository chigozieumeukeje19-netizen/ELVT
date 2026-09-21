-- ---------------------------------------------------------------------------
-- Item 38.1, the part of it that can be done without breaking the coach.
--
-- The finding that changed this migration, proven rather than assumed:
--
--   THE COACH AND THE CLIENT ARE THE SAME POSTGRES ROLE.
--
-- The coach portal builds its Supabase client from the anon key plus the
-- coach's GoTrue session (src/lib/supabase/server.ts, used by 26 files), and a
-- GoTrue session is the role `authenticated`. The client API mints its own
-- token and also claims `authenticated`. What tells a coach from a client is
-- an RLS policy calling is_staff(), which is a row-level test.
--
-- Column privileges are per role. They cannot tell two users of the same role
-- apart. Revoking UPDATE on checkin_submissions.review_note from
-- `authenticated` therefore takes it from the coach as well, and the coach's
-- check-in review is the thing that writes it. That was run: the coach's
-- update failed with `permission denied for table checkin_submissions`.
--
-- So the column list in docs/CLIENT_WRITE_PRIVILEGES.md cannot be granted as
-- written until staff have a Postgres role of their own. That is recorded at
-- the top of docs/OPEN_QUESTIONS.md with the three ways out and a
-- recommendation. This migration does the part that is pure gain and breaks
-- nothing, and stops there rather than shipping a plausible-looking half.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. anon writes nothing, anywhere.
--
-- Not one policy in this schema targets anon: every client policy and every
-- staff policy is `to authenticated`. So anon has never been able to write a
-- row, and has held INSERT, UPDATE, DELETE and TRUNCATE on all 53 tables the
-- whole time because Supabase grants them by default. Only RLS stood between
-- an anon key and `truncate audit_log`.
--
-- Nothing reads through anon either: the portal uses a session, the client API
-- mints its own token, and the intake form runs through the service role.
-- ---------------------------------------------------------------------------

revoke insert, update, delete, truncate on all tables in schema public from anon;

alter default privileges in schema public
  revoke insert, update, delete, truncate on tables from anon;

-- ---------------------------------------------------------------------------
-- 2. Columns neither a coach nor a client writes.
--
-- These are written by the engine through the service role, which bypasses
-- both RLS and these grants. Taking them from `authenticated` costs the coach
-- nothing because the coach never writes them either, so this part of the
-- audit lands now rather than waiting on the role split.
--
-- The table grant has to go first. A column-level revoke cannot take a bite
-- out of a table-level grant, which is why revoking one column and leaving the
-- table grant in place changes nothing at all -- a thing worth stating,
-- because it is the shape of a fix that looks right and does nothing.
-- ---------------------------------------------------------------------------

-- set_logs: the personal-record flags are the engine's verdict on a set.
revoke update on public.set_logs from authenticated;
grant update (
  session_exercise_id, client_id, set_number, prescribed,
  actual, logged_at, logged_for_date
) on public.set_logs to authenticated;

-- daily_logs: readiness is computed, never typed.
revoke update on public.daily_logs from authenticated;
grant update (
  client_id, date, weight, steps, water, sleep_hours,
  energy, mood, session_status, custom
) on public.daily_logs to authenticated;

-- ---------------------------------------------------------------------------
-- 3. What is deliberately NOT here.
--
-- review_note, reviewed_at, thread_id, coach_notes, one_thing, flag_config,
-- scheduled_for, touchpoint and the rest of the audit's coach-only list. Every
-- one of them is written by the coach through the same role a client holds,
-- and there is no way to grant one without granting the other until staff are
-- their own role. tests/integration/client-api.test.ts holds the full list and
-- fails on it, which is the correct state: the test is the acceptance
-- criterion for the role split rather than something to soften now.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- The writes the client API needs, and nothing more.
--
-- Part 11.2: every write validates against the JWT's client_id at the RLS
-- layer, not only in code. Three endpoints write to tables that previously had
-- only a select policy for the client role, so a route handler was the only
-- thing standing between a caller and someone else's row. That is exactly the
-- arrangement this project does not accept.
--
-- Two mechanisms, because RLS alone is not enough here. A policy decides WHICH
-- ROWS a client may touch. It cannot decide which COLUMNS, and both of these
-- tables carry columns a client must never move: a client may change their own
-- day's calorie override, but not its date; they may swap a movement, but not
-- rewrite the sets they were prescribed. So the row bound is a policy and the
-- column bound is a grant, and neither is sufficient on its own.
-- ---------------------------------------------------------------------------

-- The one day nutrition override. The week's own numbers are untouched, so
-- tomorrow goes back to the coach's plan.
create policy program_days_client_update on public.program_days
  for update to authenticated
  using (client_id = public.current_client_id())
  with check (client_id = public.current_client_id());

revoke update on public.program_days from authenticated;
grant update (calories_override, protein_override) on public.program_days to authenticated;

-- Swapping a movement for a flag safe alternative. The sets, the order and the
-- tracking fields are the coach's prescription and stay that way.
create policy session_exercises_client_update on public.session_exercises
  for update to authenticated
  using (client_id = public.current_client_id())
  with check (client_id = public.current_client_id());

revoke update on public.session_exercises from authenticated;
grant update (exercise_id, substituted_from_exercise_id)
  on public.session_exercises to authenticated;

-- A client messaging their coach for the first time has no thread yet, so the
-- API opens one. Bounded to their own client_id like everything else.
create policy threads_client_insert on public.threads
  for insert to authenticated
  with check (client_id = public.current_client_id());

-- Moving a session between days, for a client whose feature flag allows it.
-- The row bound is already in sessions_client_update; this narrows the columns
-- so the day swap cannot also rewrite the session's name or its status history.
revoke update on public.sessions from authenticated;
grant update (
  program_day_id, status, started_at, completed_at,
  difficulty_rating, duration_min, fueling_notes
) on public.sessions to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security.
--
-- Every table already has RLS enabled and no policies, which is deny-all. This
-- migration adds back exactly three kinds of access:
--
--   1. staff (coach, admin) reach everything;
--   2. a client reads the rows of their own program;
--   3. a client writes only their own logs and submissions.
--
-- Anything not listed here stays unreachable to anyone but the service role.
-- The client_id column is denormalized onto every client-scoped child table on
-- purpose: a policy that has to join upwards to find out who owns a row is both
-- slower and easier to get wrong.
-- ---------------------------------------------------------------------------

-- The Data API grants select/insert/update/delete on new public tables to anon
-- and authenticated. RLS already blocks anon, but there is no reason for a
-- signed-out request to hold the grant at all.
do $$
declare
  t record;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('revoke all on public.%I from anon', t.tablename);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff. One policy per table, applied to everything in public.
-- ---------------------------------------------------------------------------

do $$
declare
  t record;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())',
      t.tablename || '_staff_all', t.tablename
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Client read. The program and everything hanging off it.
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
  read_only text[] := array[
    'programs', 'program_weeks', 'program_days', 'sessions', 'session_sections',
    'session_exercises', 'runs', 'habits', 'meals', 'checkin_forms', 'threads',
    'client_milestones', 'celebrations', 'client_xp', 'progress_photos'
  ];
begin
  foreach t in array read_only loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (client_id = public.current_client_id())',
      t || '_client_select', t
    );
  end loop;
end;
$$;

-- A client sees their own Blueprint only once it has been approved. A draft is
-- the coach's working copy.
create policy blueprints_client_select on public.blueprints
  for select to authenticated
  using (client_id = public.current_client_id() and status = 'approved');

-- ---------------------------------------------------------------------------
-- Client write. Logs, submissions, replies and the session state the player
-- changes as the client works through it.
--
-- These policies bound the rows by client_id. Which columns a client may move
-- is the API layer's job; which rows they may touch at all is decided here, so
-- a forged request that bypasses the route handler still cannot cross clients.
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
  writable text[] := array[
    'set_logs', 'run_logs', 'habit_logs', 'meal_logs', 'daily_logs',
    'day_completion', 'devices'
  ];
begin
  foreach t in array writable loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (client_id = public.current_client_id())',
      t || '_client_select', t
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (client_id = public.current_client_id())',
      t || '_client_insert', t
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (client_id = public.current_client_id()) with check (client_id = public.current_client_id())',
      t || '_client_update', t
    );
  end loop;
end;
$$;

-- The session player marks a session started, done or skipped and rates it.
create policy sessions_client_update on public.sessions
  for update to authenticated
  using (client_id = public.current_client_id())
  with check (client_id = public.current_client_id());

-- Submitting a check-in, and replying to the coach's review.
create policy checkin_submissions_client_select on public.checkin_submissions
  for select to authenticated
  using (client_id = public.current_client_id());

create policy checkin_submissions_client_insert on public.checkin_submissions
  for insert to authenticated
  with check (client_id = public.current_client_id());

create policy checkin_submissions_client_update on public.checkin_submissions
  for update to authenticated
  using (client_id = public.current_client_id())
  with check (client_id = public.current_client_id());

-- Messages. A client reads their own thread and writes into it, including the
-- reply to a check-in review, which is what makes the review a conversation
-- rather than one way feedback.
create policy messages_client_select on public.messages
  for select to authenticated
  using (client_id = public.current_client_id() and sent_at is not null);

create policy messages_client_insert on public.messages
  for insert to authenticated
  with check (
    client_id = public.current_client_id()
    and sender_id = auth.uid()
  );

create policy messages_client_update on public.messages
  for update to authenticated
  using (client_id = public.current_client_id())
  with check (client_id = public.current_client_id());

-- Progress photos are written by the client and read back in the gallery.
create policy progress_photos_client_insert on public.progress_photos
  for insert to authenticated
  with check (client_id = public.current_client_id());

-- Intake. The client fills the questionnaire once, before anything else exists.
create policy questionnaire_responses_client_select on public.questionnaire_responses
  for select to authenticated
  using (client_id = public.current_client_id());

create policy questionnaire_responses_client_insert on public.questionnaire_responses
  for insert to authenticated
  with check (client_id = public.current_client_id());

create policy questionnaire_responses_client_update on public.questionnaire_responses
  for update to authenticated
  using (client_id = public.current_client_id())
  with check (client_id = public.current_client_id());

create policy questionnaires_client_select on public.questionnaires
  for select to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------

create policy profiles_self_select on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy profiles_self_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = public.current_app_role());

create policy clients_self_select on public.clients
  for select to authenticated
  using (id = public.current_client_id());

-- ---------------------------------------------------------------------------
-- Library. The client app renders demos, cues and flag-safe swap lists, so it
-- reads these three tables and nothing else in the library.
-- ---------------------------------------------------------------------------

create policy exercises_client_select on public.exercises
  for select to authenticated
  using (true);

create policy exercise_alternatives_client_select on public.exercise_alternatives
  for select to authenticated
  using (true);

create policy exercise_contraindications_client_select on public.exercise_contraindications
  for select to authenticated
  using (true);

create policy habits_library_client_select on public.habits_library
  for select to authenticated
  using (true);

create policy milestones_client_select on public.milestones
  for select to authenticated
  using (true);

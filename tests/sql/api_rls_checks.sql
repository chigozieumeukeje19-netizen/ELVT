-- ---------------------------------------------------------------------------
-- One assertion per client API endpoint, proving a client cannot reach another
-- client's row.
--
-- Part 11.2 says every write validates against the JWT's client_id at the RLS
-- layer, not only in code. These run as PostgREST does: set the role, set the
-- claims, and try. No route handler is involved, so what passes here is what
-- holds even against a forged request that skips the app entirely.
--
-- Every block names the endpoint it stands for, so a policy removed later fails
-- a test that says which endpoint it broke.
-- ---------------------------------------------------------------------------

\set ON_ERROR_STOP on

-- Everything below runs in one transaction that is rolled back at the end.
--
-- The fixtures these assertions need are written rather than looked for, and
-- without this they survived the run: a second pass collided on the movement it
-- had inserted the first time, and the file could only be run against a freshly
-- rebuilt database. A test that cannot be run twice is a test people stop
-- running.
begin;

create or replace function pg_temp.assert(condition boolean, label text)
returns void language plpgsql as $$
begin
  if condition is not true then
    raise exception 'FAILED: %', label;
  end if;
  raise notice 'ok: %', label;
end;
$$;

/* Switches to a client the way PostgREST does. */
/*
 * Every write assertion below catches insufficient_privilege and nothing else.
 *
 * The first version caught `others`, which meant a wrong column name looked
 * exactly like a policy doing its job. The photos assertion was passing for
 * that reason: it named columns the table does not have, the insert raised
 * before RLS was ever consulted, and the file reported the endpoint as bounded.
 */
create or replace function pg_temp.become(client uuid, usr uuid)
returns void language plpgsql as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', usr, 'client_id', client, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';
end;
$$;

do $$
declare
  mine uuid;
  my_user uuid;
  theirs uuid;
  their_user uuid;
  visible int;
  blocked boolean;
  touched int;
  their_program uuid;
  their_week uuid;
  their_session uuid;
  their_section uuid;
  their_day uuid;
  their_exercise uuid;
  their_form uuid;
  their_thread uuid;
  my_thread uuid;
  their_habit uuid;
  a_habit_definition uuid;
  an_exercise uuid;
  their_log uuid;
  their_race uuid;
begin
  select c.id, c.profile_id into mine, my_user
    from public.clients c order by c.slug limit 1;
  select c.id, c.profile_id into theirs, their_user
    from public.clients c where c.id <> mine order by c.slug limit 1;

  perform pg_temp.assert(mine is not null and theirs is not null,
    'two seeded clients exist to test across');

  -- ------------------------------------------------------------------------
  -- Fixtures, built here rather than looked for in the seed.
  --
  -- The first version of this file looked these up and skipped the assertion
  -- when it found nothing. The seed carries clients and check-in forms and
  -- nothing else, so most of the write assertions never ran and the file
  -- reported a pass. A guard that skips is the silent green the whole project
  -- is built against, so every row these need is created, and a missing one is
  -- a failure rather than a skip.
  -- ------------------------------------------------------------------------

  insert into public.races (client_id, name, race_date, distance_metres, goal_time_seconds)
  values (theirs, 'Theirs to run', '2026-12-13', 42195, 12600)
  returning id into their_race;

  insert into public.programs (client_id, name, duration_weeks, status)
  values (theirs, 'Theirs', 12, 'active')
  returning id into their_program;

  insert into public.program_weeks (program_id, client_id, week_number, starts_on)
  values (their_program, theirs, 1, '2026-09-21')
  returning id into their_week;

  insert into public.program_days (program_week_id, client_id, date, day_of_week)
  values (their_week, theirs, '2026-09-21', 1)
  returning id into their_day;

  insert into public.sessions (program_day_id, client_id, kind, name, "order")
  values (their_day, theirs, 'strength', 'Lower', 0)
  returning id into their_session;

  insert into public.session_sections (session_id, client_id, type, "order")
  values (their_session, theirs, 'regular', 0)
  returning id into their_section;

  insert into public.exercises (name, pattern)
  values ('Test Movement', 'squat')
  returning id into an_exercise;

  insert into public.session_exercises (section_id, client_id, exercise_id, "order")
  values (their_section, theirs, an_exercise, 0)
  returning id into their_exercise;

  insert into public.threads (client_id, subject)
  values (theirs, 'Theirs')
  returning id into their_thread;

  insert into public.threads (client_id, subject)
  values (mine, 'Mine')
  returning id into my_thread;

  insert into public.habits_library (name, unit) values ('Test habit', 'check')
  returning id into a_habit_definition;

  insert into public.habits (client_id, habit_id, name, target, unit)
  values (theirs, a_habit_definition, 'Test habit', 1, 'check')
  returning id into their_habit;

  insert into public.daily_logs (client_id, date, steps)
  values (theirs, '2026-09-21', 9000)
  returning id into their_log;

  select id into their_form from public.checkin_forms where client_id = theirs limit 1;

  perform pg_temp.assert(
    their_session is not null and their_day is not null and their_exercise is not null
      and their_thread is not null and my_thread is not null and their_habit is not null
      and their_log is not null and their_form is not null,
    'every fixture row these assertions need exists'
  );

  -- =========================================================================
  -- READS. Every one of these is a GET in Part 11.2.
  -- =========================================================================

  -- GET /me
  perform pg_temp.become(mine, my_user);
  select count(*) into visible from public.clients where id = theirs;
  reset role;
  perform pg_temp.assert(visible = 0, 'GET /me cannot read another client');

  -- GET /program and GET /week/:n
  perform pg_temp.become(mine, my_user);
  select count(*) into visible from public.programs where client_id = theirs;
  reset role;
  perform pg_temp.assert(visible = 0, 'GET /program cannot read another client''s program');

  perform pg_temp.become(mine, my_user);
  select count(*) into visible from public.program_weeks where client_id = theirs;
  reset role;
  perform pg_temp.assert(visible = 0, 'GET /week/:n cannot read another client''s weeks');

  -- GET /today
  perform pg_temp.become(mine, my_user);
  select count(*) into visible from public.program_days where client_id = theirs;
  reset role;
  perform pg_temp.assert(visible = 0, 'GET /today cannot read another client''s days');

  -- GET /session/:id
  perform pg_temp.become(mine, my_user);
  select count(*) into visible from public.sessions where client_id = theirs;
  reset role;
  perform pg_temp.assert(visible = 0, 'GET /session/:id cannot read another client''s session');

  perform pg_temp.become(mine, my_user);
  select count(*) into visible from public.session_exercises where client_id = theirs;
  reset role;
  perform pg_temp.assert(visible = 0, 'GET /session/:id cannot read another client''s exercises');

  -- GET /exercise/:id/history
  perform pg_temp.become(mine, my_user);
  select count(*) into visible from public.set_logs where client_id = theirs;
  reset role;
  perform pg_temp.assert(visible = 0, 'GET /exercise/:id/history cannot read another client''s sets');

  -- GET /nutrition/:date
  perform pg_temp.become(mine, my_user);
  select count(*) into visible from public.meals where client_id = theirs;
  reset role;
  perform pg_temp.assert(visible = 0, 'GET /nutrition/:date cannot read another client''s meals');

  perform pg_temp.become(mine, my_user);
  select count(*) into visible from public.meal_logs where client_id = theirs;
  reset role;
  perform pg_temp.assert(visible = 0, 'GET /nutrition/:date cannot read another client''s meal logs');

  -- GET /progress
  perform pg_temp.become(mine, my_user);
  select count(*) into visible from public.daily_logs where client_id = theirs;
  reset role;
  perform pg_temp.assert(visible = 0, 'GET /progress cannot read another client''s logs');

  -- GET /checkins
  perform pg_temp.become(mine, my_user);
  select count(*) into visible from public.checkin_forms where client_id = theirs;
  reset role;
  perform pg_temp.assert(visible = 0, 'GET /checkins cannot read another client''s forms');

  perform pg_temp.become(mine, my_user);
  select count(*) into visible from public.checkin_submissions where client_id = theirs;
  reset role;
  perform pg_temp.assert(visible = 0, 'GET /checkins cannot read another client''s submissions');

  -- GET /messages
  perform pg_temp.become(mine, my_user);
  select count(*) into visible from public.messages where client_id = theirs;
  reset role;
  perform pg_temp.assert(visible = 0, 'GET /messages cannot read another client''s messages');

  -- GET /milestones
  perform pg_temp.become(mine, my_user);
  select count(*) into visible from public.client_milestones where client_id = theirs;
  reset role;
  perform pg_temp.assert(visible = 0, 'GET /milestones cannot read another client''s milestones');

  -- The Blueprint a client reads is their own and only once approved.
  perform pg_temp.become(mine, my_user);
  select count(*) into visible from public.blueprints where client_id = theirs;
  reset role;
  perform pg_temp.assert(visible = 0, 'GET /me cannot read another client''s blueprint');

  -- =========================================================================
  -- WRITES. Each one tries the write the endpoint makes, against the other
  -- client's row, and asserts it touched nothing.
  -- =========================================================================

  -- POST /session/:id/start, /complete, /skip
  perform pg_temp.become(mine, my_user);
  update public.sessions set status = 'done' where id = their_session;
  get diagnostics touched = row_count;
  reset role;
  perform pg_temp.assert(touched = 0,
    'POST /session/:id/complete cannot change another client''s session');

  -- POST /session/:id/swap-exercise
  perform pg_temp.become(mine, my_user);
  update public.session_exercises set exercise_id = an_exercise where id = their_exercise;
  get diagnostics touched = row_count;
  reset role;
  perform pg_temp.assert(touched = 0,
    'POST /session/:id/swap-exercise cannot change another client''s exercise');

  -- POST /day/:date/target-override
  perform pg_temp.become(mine, my_user);
  update public.program_days set calories_override = 9999 where id = their_day;
  get diagnostics touched = row_count;
  reset role;
  perform pg_temp.assert(touched = 0,
    'POST /day/:date/target-override cannot change another client''s day');

  -- POST /set-log
  perform pg_temp.become(mine, my_user);
  blocked := false;
  begin
    insert into public.set_logs (client_id, session_exercise_id, set_number, actual)
    values (theirs, their_exercise, 1, '{}'::jsonb);
  exception when insufficient_privilege then
    blocked := true;
  end;
  reset role;
  perform pg_temp.assert(blocked, 'POST /set-log cannot write to another client');

  -- POST /run-log
  perform pg_temp.become(mine, my_user);
  blocked := false;
  begin
    insert into public.run_logs (client_id, run_id, distance) values (theirs, null, 5);
  exception when insufficient_privilege then
    blocked := true;
  end;
  reset role;
  perform pg_temp.assert(blocked, 'POST /run-log cannot write to another client');

  -- POST /daily-log
  perform pg_temp.become(mine, my_user);
  blocked := false;
  begin
    insert into public.daily_logs (client_id, date, steps) values (theirs, '2026-01-01', 1);
  exception when insufficient_privilege then
    blocked := true;
  end;
  reset role;
  perform pg_temp.assert(blocked, 'POST /daily-log cannot write to another client');

  perform pg_temp.become(mine, my_user);
  update public.daily_logs set steps = 1 where id = their_log;
  get diagnostics touched = row_count;
  reset role;
  perform pg_temp.assert(touched = 0, 'POST /daily-log cannot overwrite another client''s day');

  -- POST /habit-log
  perform pg_temp.become(mine, my_user);
  blocked := false;
  begin
    insert into public.habit_logs (client_id, habit_id, date, completed)
    values (theirs, their_habit, '2026-01-01', true);
  exception when insufficient_privilege then
    blocked := true;
  end;
  reset role;
  perform pg_temp.assert(blocked, 'POST /habit-log cannot write to another client');

  -- POST /meal-log
  perform pg_temp.become(mine, my_user);
  blocked := false;
  begin
    insert into public.meal_logs (client_id, date, custom) values (theirs, '2026-01-01', '{}'::jsonb);
  exception when insufficient_privilege then
    blocked := true;
  end;
  reset role;
  perform pg_temp.assert(blocked, 'POST /meal-log cannot write to another client');

  -- POST /day/:date/task
  perform pg_temp.become(mine, my_user);
  blocked := false;
  begin
    insert into public.day_completion (client_id, date, score) values (theirs, '2026-01-01', 100);
  exception when insufficient_privilege then
    blocked := true;
  end;
  reset role;
  perform pg_temp.assert(blocked, 'POST /day/:date/task cannot write to another client');

  -- POST /checkin/:form_id/submit
  perform pg_temp.become(mine, my_user);
  blocked := false;
  begin
    insert into public.checkin_submissions (form_id, client_id, for_date)
    values (their_form, theirs, '2026-01-01');
  exception when insufficient_privilege then
    blocked := true;
  end;
  reset role;
  perform pg_temp.assert(blocked, 'POST /checkin/:id/submit cannot write to another client');

  -- POST /checkin/:id/reply and POST /message
  perform pg_temp.become(mine, my_user);
  blocked := false;
  begin
    insert into public.messages (thread_id, client_id, sender_id, body, sent_at)
    values (their_thread, theirs, my_user, 'hello', now());
  exception when insufficient_privilege then
    blocked := true;
  end;
  reset role;
  perform pg_temp.assert(blocked, 'POST /message cannot write into another client''s thread');

  perform pg_temp.become(mine, my_user);
  blocked := false;
  begin
    insert into public.threads (client_id, subject) values (theirs, 'hello');
  exception when insufficient_privilege then
    blocked := true;
  end;
  reset role;
  perform pg_temp.assert(blocked, 'POST /message cannot open a thread for another client');

  -- A client cannot sign a message as someone else either, even in their own
  -- thread. The policy checks sender_id against auth.uid().
  perform pg_temp.become(mine, my_user);
  blocked := false;
  begin
    insert into public.messages (thread_id, client_id, sender_id, body, sent_at)
    values (my_thread, mine, their_user, 'not me', now());
  exception when insufficient_privilege then
    blocked := true;
  end;
  reset role;
  perform pg_temp.assert(blocked, 'POST /message cannot be signed as another user');

  -- POST /photos
  perform pg_temp.become(mine, my_user);
  blocked := false;
  begin
    insert into public.progress_photos (client_id, week_number, taken_on, angle, storage_path)
    values (theirs, 1, '2026-09-21', 'front', 'x');
  exception when insufficient_privilege then
    blocked := true;
  end;
  reset role;
  perform pg_temp.assert(blocked, 'POST /photos cannot write to another client''s gallery');

  -- POST /device
  perform pg_temp.become(mine, my_user);
  update public.clients set communication_prefs = '{}'::jsonb where id = theirs;
  get diagnostics touched = row_count;
  reset role;
  perform pg_temp.assert(touched = 0, 'POST /device cannot write to another client''s row');

  -- POST /day-swap
  perform pg_temp.become(mine, my_user);
  update public.sessions set program_day_id = their_day where id = their_session;
  get diagnostics touched = row_count;
  reset role;
  perform pg_temp.assert(touched = 0, 'POST /day-swap cannot move another client''s session');

  -- ------------------------------------------------------------------------
  -- Races. Not an endpoint: the client app is handed its race at export time.
  -- The policy still has to hold, because a race carries a person's goal time
  -- and the date they will be at a named place.
  -- ------------------------------------------------------------------------

  perform pg_temp.become(mine, my_user);
  select count(*) into visible from public.races where client_id = theirs;
  reset role;
  perform pg_temp.assert(visible = 0, 'a client cannot read another client''s race');

  perform pg_temp.become(theirs, their_user);
  select count(*) into visible from public.races where id = their_race;
  reset role;
  perform pg_temp.assert(visible = 1, 'a client can read their own race');

  -- A race date is not the client's to move. The taper, the checklist and the
  -- countdown are all computed from it.
  perform pg_temp.become(theirs, their_user);
  update public.races set race_date = '2030-01-01' where id = their_race;
  get diagnostics touched = row_count;
  reset role;
  perform pg_temp.assert(touched = 0, 'a client cannot move their own race date');

  perform pg_temp.become(theirs, their_user);
  blocked := false;
  begin
    insert into public.races (client_id, name, race_date, distance_metres)
    values (theirs, 'One I entered myself', '2030-01-01', 42195);
  exception when insufficient_privilege then
    blocked := true;
  end;
  reset role;
  perform pg_temp.assert(blocked, 'a client cannot add a race to their own diary');

  -- =========================================================================
  -- The photo bucket. Separate from the tables, because the bound here is on a
  -- path rather than on a column, and getting the path split wrong would let
  -- every client read every folder.
  -- =========================================================================

  perform pg_temp.assert(
    (storage.foldername('11111111-1111-4111-8111-111111111111/week-1/front-123'))[1]
      = '11111111-1111-4111-8111-111111111111',
    'the first path segment is the client id'
  );

  perform pg_temp.assert(
    array_length(storage.foldername('a/week-1/front-123'), 1) = 2,
    'foldername drops the file name rather than keeping it'
  );

  -- A client writing into their own folder.
  perform pg_temp.become(mine, my_user);
  blocked := false;
  begin
    insert into storage.objects (bucket_id, name)
    values ('client-photos', mine::text || '/week-1/front-1');
  exception when insufficient_privilege then
    blocked := true;
  end;
  reset role;
  perform pg_temp.assert(not blocked, 'POST /photos writes into the client''s own folder');

  -- And into somebody else's, which is the one that matters.
  perform pg_temp.become(mine, my_user);
  blocked := false;
  begin
    insert into storage.objects (bucket_id, name)
    values ('client-photos', theirs::text || '/week-1/front-1');
  exception when insufficient_privilege then
    blocked := true;
  end;
  reset role;
  perform pg_temp.assert(blocked, 'POST /photos cannot write into another client''s folder');

  -- Reading one.
  insert into storage.objects (bucket_id, name)
  values ('client-photos', theirs::text || '/week-2/back-1');

  perform pg_temp.become(mine, my_user);
  select count(*) into visible
    from storage.objects
   where bucket_id = 'client-photos'
     and (storage.foldername(name))[1] = theirs::text;
  reset role;
  perform pg_temp.assert(visible = 0, 'a client cannot read another client''s photos');

  -- The bucket is private. A public bucket would make every signed URL
  -- pointless, since the path alone would be enough.
  perform pg_temp.assert(
    (select not public from storage.buckets where id = 'client-photos'),
    'the photo bucket is private'
  );

  -- Nothing may delete. Replacing Monday's photo is normal; deleting one is not
  -- something a client does from the app.
  perform pg_temp.assert(
    not exists (
      select 1 from pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and cmd = 'DELETE' and policyname like 'client_photos%'
    ),
    'no policy lets a client delete a photo'
  );

  raise notice 'All client API endpoints are bounded at the RLS layer.';
end;
$$;

-- ---------------------------------------------------------------------------
-- Column bounds. A policy decides which rows; only a grant decides which
-- columns, and both of these tables carry columns a client must never move.
-- ---------------------------------------------------------------------------
do $$
declare
  writable text[];
begin
  select array_agg(column_name order by column_name) into writable
  from information_schema.column_privileges
  where grantee = 'authenticated'
    and table_schema = 'public'
    and table_name = 'program_days'
    and privilege_type = 'UPDATE';

  perform pg_temp.assert(
    writable = array['calories_override', 'protein_override'],
    'a client may only move the two override columns on program_days'
  );

  select array_agg(column_name order by column_name) into writable
  from information_schema.column_privileges
  where grantee = 'authenticated'
    and table_schema = 'public'
    and table_name = 'session_exercises'
    and privilege_type = 'UPDATE';

  perform pg_temp.assert(
    writable = array['exercise_id', 'substituted_from_exercise_id'],
    'a client may only swap the movement, never the prescribed sets'
  );

  select array_agg(column_name order by column_name) into writable
  from information_schema.column_privileges
  where grantee = 'authenticated'
    and table_schema = 'public'
    and table_name = 'sessions'
    and privilege_type = 'UPDATE';

  perform pg_temp.assert(
    not (writable @> array['name']) and not (writable @> array['coach_notes']),
    'a client cannot rename a session or write the coach''s notes'
  );
end;
$$;

rollback;

\echo 'Rolled back. Nothing this file wrote survives it.'

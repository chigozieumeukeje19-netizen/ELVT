-- ---------------------------------------------------------------------------
-- ELVT OS seed.
--
-- EVERY PERSON IN THIS FILE IS INVENTED. No real client name, email, weight,
-- injury, unit, deployment or race appears anywhere in it. The eight clients
-- are shaped like the real roster only in the sense that between them they
-- exercise every rule path: a spine flag, a calf flag, a combat sport lifting
-- cap, a client with calorie tracking switched off, a deployed runner eating
-- from a fixed menu, a fitness test rebuild, an HRV led race prep, and a long
-- transformation.
--
-- Local and preview only. Nothing here is ever loaded into ELVT OS PROD.
-- ---------------------------------------------------------------------------

begin;

-- ---------------------------------------------------------------------------
-- NO AUTH ROWS ARE WRITTEN HERE.
--
-- This file writes public schema rows only. Every auth user is created through
-- GoTrue's admin API in scripts/seed-auth.ts, which then writes the matching
-- profile and links the client by slug.
--
-- That is not a preference. Hand writing an auth.users row has now broken sign
-- in twice, both times because a column had to hold something this file did not
-- know to give it:
--
--   auth.identities.email is GENERATED ALWAYS, so naming it at all fails.
--   auth.users.confirmation_token and the other token columns are NULL here
--   but GoTrue scans them into Go strings, which cannot take NULL, so every
--   single user lookup returned a 500 and nobody could sign in.
--
-- Both were invisible locally because the stand-in schema was more forgiving
-- than the real one. There is no way to be sure the third column is not
-- waiting, so the seed stops guessing and lets GoTrue write its own rows.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- The eight synthetic clients
-- ---------------------------------------------------------------------------

create temporary table seed_clients (
  slug text primary key,
  email text not null,
  first_name text not null,
  last_name text not null,
  sex text not null,
  dob date not null,
  height_cm numeric,
  start_weight numeric,
  goal_weight numeric,
  units text not null,
  primary_goal text not null,
  goal_statement text not null,
  occupation text,
  location text,
  program_length_weeks int not null,
  calorie_target int,
  flag_config jsonb not null,
  feature_flags jsonb not null,
  one_thing text not null,
  comms jsonb not null
) on commit drop;

insert into seed_clients values
  -- 1. Recomp with a spine flag. Nothing loaded through the spine ever reaches
  --    this program, which is what the contraindication join is for.
  ('nadia-brookes', 'nadia.brookes@elvt.test', 'Nadia', 'Brookes', 'female', '1991-04-12',
   168, 172.0, 158.0, 'imperial', 'recomp',
   'Hold my weight steady and change the shape of it over sixteen weeks.',
   'Dental hygienist', 'Columbus, Ohio', 16, 2150,
   '{"spine": true}'::jsonb,
   '{"workouts":true,"running":false,"nutrition_tracker":true,"meal_plan":true,"steps":true,"water":true,"habits":true,"photos":true,"checkins":true,"messaging":true,"community":false}'::jsonb,
   'Protein at breakfast. She skips it and the whole day misses.',
   '{"tone":"warm","directness":"medium","reminder_time":"07:00","preferred_channel":"app"}'::jsonb),

  -- 2. Marathoner with a calf flag. Calf above 5 is a same day trigger, not a
  --    Monday item.
  ('theo-vance', 'theo.vance@elvt.test', 'Theo', 'Vance', 'male', '1987-09-03',
   181, 178.0, 170.0, 'imperial', 'race_prep',
   'Get to the start line healthy and run it under three thirty.',
   'Software engineer', 'Portland, Oregon', 18, 2900,
   '{"achilles": true, "calf_watch": true}'::jsonb,
   '{"workouts":true,"running":true,"nutrition_tracker":true,"meal_plan":false,"steps":true,"water":true,"habits":true,"photos":false,"checkins":true,"messaging":true,"community":false}'::jsonb,
   'Calf rating. Above five and the long run changes that day.',
   '{"tone":"direct","directness":"high","reminder_time":"05:30","preferred_channel":"app"}'::jsonb),

  -- 3. Combat sport plus lifting. The template applier caps him at three lifts
  --    because the sport is already the fourth and fifth hard session.
  ('marcus-oyelaran', 'marcus.oyelaran@elvt.test', 'Marcus', 'Oyelaran', 'male', '1995-01-22',
   177, 190.0, 183.0, 'imperial', 'performance',
   'Make weight without losing strength and stop gassing in round three.',
   'Warehouse supervisor', 'Newark, New Jersey', 12, 2750,
   '{"shoulder": true, "combat_sport": true}'::jsonb,
   '{"workouts":true,"running":true,"nutrition_tracker":true,"meal_plan":true,"steps":true,"water":true,"habits":true,"photos":true,"checkins":true,"messaging":true,"community":false}'::jsonb,
   'Sessions per week. Four lifts plus sparring is how he gets hurt.',
   '{"tone":"blunt","directness":"high","reminder_time":"06:00","preferred_channel":"app"}'::jsonb),

  -- 4. No calorie tracking. Habits only. The nutrition tracker tab has to
  --    disappear rather than sit there empty.
  ('priya-raghavan', 'priya.raghavan@elvt.test', 'Priya', 'Raghavan', 'female', '1984-11-30',
   161, 154.0, 142.0, 'imperial', 'fat_loss',
   'Lose weight without counting anything. Counting sent me backwards before.',
   'Paediatric nurse', 'Sacramento, California', 16, null,
   '{"knee": true}'::jsonb,
   '{"workouts":true,"running":false,"nutrition_tracker":false,"meal_plan":false,"steps":true,"water":true,"habits":true,"photos":true,"checkins":true,"messaging":true,"community":false}'::jsonb,
   'Protein at two meals, and steps. No numbers beyond that.',
   '{"tone":"warm","directness":"low","reminder_time":"08:00","preferred_channel":"app"}'::jsonb),

  -- 5. Deployed runner eating from a fixed dining facility menu. Meals come
  --    from a short list, so the swap list matters more than the macro maths.
  ('elena-marsh', 'elena.marsh@elvt.test', 'Elena', 'Marsh', 'female', '1993-06-17',
   170, 149.0, 145.0, 'imperial', 'maintain',
   'Keep running through the rotation and come home no worse off.',
   'Logistics NCO', 'Deployed, GMT+3', 20, 2400,
   '{"hip": true, "dining_facility": true}'::jsonb,
   '{"workouts":true,"running":true,"nutrition_tracker":true,"meal_plan":true,"steps":true,"water":true,"habits":true,"photos":false,"checkins":true,"messaging":true,"community":false}'::jsonb,
   'Sleep hours. Everything else follows the shift pattern.',
   '{"tone":"direct","directness":"medium","reminder_time":"04:30","preferred_channel":"app"}'::jsonb),

  -- 6. Fitness test rebuild. Two events he fails, everything else is fine.
  ('jonah-petrakis', 'jonah.petrakis@elvt.test', 'Jonah', 'Petrakis', 'male', '1998-02-08',
   175, 205.0, 188.0, 'imperial', 'fitness_test',
   'Pass the two mile and the plank in twelve weeks. Nothing else matters.',
   'Mechanic', 'San Antonio, Texas', 12, 2600,
   '{"knee": true, "spine": true}'::jsonb,
   '{"workouts":true,"running":true,"nutrition_tracker":true,"meal_plan":false,"steps":true,"water":true,"habits":true,"photos":true,"checkins":true,"messaging":true,"community":false}'::jsonb,
   'Two mile pace. The plank takes care of itself once the weight moves.',
   '{"tone":"blunt","directness":"high","reminder_time":"06:30","preferred_channel":"app"}'::jsonb),

  -- 7. Race prep led by recovery rather than mileage. Readiness gates the week.
  ('aisha-nkemdirim', 'aisha.nkemdirim@elvt.test', 'Aisha', 'Nkemdirim', 'female', '1990-08-25',
   173, 141.0, 138.0, 'imperial', 'race_prep',
   'Half marathon in fourteen weeks, and stop training through the bad weeks.',
   'Architect', 'Atlanta, Georgia', 14, 2350,
   '{"rib": true}'::jsonb,
   '{"workouts":true,"running":true,"nutrition_tracker":true,"meal_plan":false,"steps":true,"water":true,"habits":true,"photos":false,"checkins":true,"messaging":true,"community":false}'::jsonb,
   'Readiness. Two low mornings in a row and the hard session moves.',
   '{"tone":"warm","directness":"medium","reminder_time":"06:00","preferred_channel":"app"}'::jsonb),

  -- 8. Six month transformation. The long path, where the calorie curve and the
  --    phase changes do the work.
  ('caleb-whitlock', 'caleb-whitlock@elvt.test', 'Caleb', 'Whitlock', 'male', '1979-12-05',
   183, 254.0, 210.0, 'imperial', 'fat_loss',
   'Twenty six weeks. I want to be a different size by the end of it.',
   'Regional sales manager', 'Charlotte, North Carolina', 26, 2800,
   '{"knee": true, "shoulder": true, "spine": true}'::jsonb,
   '{"workouts":true,"running":false,"nutrition_tracker":true,"meal_plan":true,"steps":true,"water":true,"habits":true,"photos":true,"checkins":true,"messaging":true,"community":false}'::jsonb,
   'Steps. He trains fine and then sits down for eleven hours.',
   '{"tone":"direct","directness":"medium","reminder_time":"07:30","preferred_channel":"app"}'::jsonb);

-- profile_id is left null. scripts/seed-auth.ts fills it in by slug after
-- GoTrue has created the accounts.
insert into public.clients (
  slug, first_name, last_name, sex, dob, height_cm, start_weight,
  goal_weight, units, status, program_start_date, program_length_weeks,
  primary_goal, goal_statement, occupation, location, timezone, calorie_target,
  communication_prefs, flag_config, feature_flags, one_thing
)
select
  sc.slug, sc.first_name, sc.last_name, sc.sex, sc.dob, sc.height_cm,
  sc.start_weight, sc.goal_weight, sc.units, 'active',
  date_trunc('week', current_date)::date, sc.program_length_weeks,
  sc.primary_goal, sc.goal_statement, sc.occupation, sc.location,
  'America/New_York', sc.calorie_target,
  sc.comms, sc.flag_config, sc.feature_flags, sc.one_thing
from seed_clients sc;

-- Approved Blueprints. Everything downstream generates from these, so a client
-- without one is a client the portal cannot act on.
insert into public.blueprints (client_id, version, status, content, approved_at)
select
  c.id, 1, 'approved',
  jsonb_build_object(
    'goals', sc.goal_statement,
    'duration_weeks', sc.program_length_weeks,
    'calorie_target', sc.calorie_target,
    'step_goal', 8000,
    'constraints', sc.flag_config,
    'one_thing', sc.one_thing,
    'comm_prefs', sc.comms,
    'tone', sc.comms ->> 'tone'
  ),
  now()
from public.clients c
join seed_clients sc on sc.slug = c.slug;

-- Default scoring weights. A null client_id is the row everyone falls back to.
insert into public.scoring_config (client_id) values (null);

commit;

-- ---------------------------------------------------------------------------
-- Shared library. Not client data: these are the building blocks the check-in
-- engine and the trigger engine read.
-- ---------------------------------------------------------------------------

begin;

insert into public.habits_library (name, unit, default_target) values
  ('Steps', 'steps', 8000),
  ('Water', 'oz', 100),
  ('Protein at breakfast', 'check', null),
  ('Sleep', 'hours', 7),
  ('Mobility', 'minutes', 10),
  ('Daily walk', 'minutes', 20);

-- The first four daily questions are identical for every client. Everything
-- after is pulled from this bank by goal and flag.
insert into public.question_bank (key, text, type, options, category, applies_when, produces) values
  ('daily_session', 'Did you get the session done?', 'multiple_choice',
   '["Yes","Modified","No"]'::jsonb, 'shared', '{}'::jsonb, '["session_status"]'::jsonb),
  ('daily_sleep', 'How many hours did you sleep?', 'metric',
   '[]'::jsonb, 'shared', '{}'::jsonb, '["sleep_hours"]'::jsonb),
  ('daily_energy', 'Energy today, 1 to 10?', 'scale',
   '[]'::jsonb, 'shared', '{}'::jsonb, '["energy"]'::jsonb),
  ('daily_steps', 'Steps today?', 'metric',
   '[]'::jsonb, 'shared', '{}'::jsonb, '["steps"]'::jsonb),
  ('weekly_weight', 'Fasted weight this morning?', 'metric',
   '[]'::jsonb, 'shared', '{}'::jsonb, '["weight"]'::jsonb),
  ('weekly_adherence', 'Adherence this week, 1 to 10?', 'scale',
   '[]'::jsonb, 'accountability', '{}'::jsonb, '["adherence"]'::jsonb),
  ('weekly_win', 'Biggest win this week?', 'text',
   '[]'::jsonb, 'accountability', '{}'::jsonb, '[]'::jsonb),
  ('weekly_struggle', 'Biggest struggle this week?', 'text',
   '[]'::jsonb, 'accountability', '{}'::jsonb, '[]'::jsonb),
  ('weekly_one_thing', 'What is the one thing you know you should be doing and are not?', 'text',
   '[]'::jsonb, 'accountability', '{}'::jsonb, '["one_thing"]'::jsonb),
  ('weekly_photos', 'Did you take your photos?', 'yes_no',
   '[]'::jsonb, 'shared', '{"feature":"photos"}'::jsonb, '[]'::jsonb),
  ('calf_rating', 'Calf, 0 to 10, where 0 is nothing at all?', 'scale',
   '[]'::jsonb, 'injury', '{"flags":["calf_watch","achilles"]}'::jsonb, '["calf_rating"]'::jsonb),
  ('back_rating', 'Any back discomfort today?', 'multiple_choice',
   '["None","Mild","Moderate","Stop"]'::jsonb, 'injury', '{"flags":["spine"]}'::jsonb, '["back_status"]'::jsonb),
  ('knee_rating', 'Knee, 0 to 10?', 'scale',
   '[]'::jsonb, 'injury', '{"flags":["knee"]}'::jsonb, '["knee_rating"]'::jsonb),
  ('calories_hit', 'Did you hit your calorie number?', 'yes_no',
   '[]'::jsonb, 'nutrition', '{"feature":"nutrition_tracker"}'::jsonb, '["calories"]'::jsonb),
  ('protein_hit', 'Did you hit your protein number?', 'yes_no',
   '[]'::jsonb, 'nutrition', '{}'::jsonb, '["protein"]'::jsonb),
  ('run_felt', 'How did the run feel?', 'multiple_choice',
   '["Easy","Ok","Hard"]'::jsonb, 'running', '{"feature":"running"}'::jsonb, '["run_feel"]'::jsonb),
  ('mileage_confirm', 'Did you cover the mileage on the plan?', 'yes_no',
   '[]'::jsonb, 'running', '{"feature":"running"}'::jsonb, '["planned_mileage"]'::jsonb),
  ('readiness_rating', 'Readiness this morning, 1 to 10?', 'scale',
   '[]'::jsonb, 'recovery', '{"goal_types":["race_prep"]}'::jsonb, '["readiness"]'::jsonb),
  ('week1_structure', 'Does the structure fit your life?', 'text',
   '[]'::jsonb, 'fit', '{"week":1}'::jsonb, '[]'::jsonb),
  ('week1_confusing', 'What confused you this week?', 'text',
   '[]'::jsonb, 'fit', '{"week":1}'::jsonb, '[]'::jsonb),
  ('week1_unsustainable', 'What felt unsustainable?', 'text',
   '[]'::jsonb, 'fit', '{"week":1}'::jsonb, '[]'::jsonb);

insert into public.trigger_presets (key, name, expression, default_threshold, suggested_message) values
  ('steps_under', 'Steps under target two days running',
   '{"metric":"steps","op":"<","consecutive_days":2}'::jsonb, 6000,
   'Steps were under {threshold} two days running. What got in the way?'),
  ('no_activity_72h', 'No activity for 72 hours',
   '{"metric":"last_activity_at","op":">","unit":"hours"}'::jsonb, 72,
   'Nothing logged since {last_activity}. Everything ok?'),
  ('two_missed_sessions', 'Two missed sessions in a week',
   '{"metric":"sessions_missed","op":">=","window":"week"}'::jsonb, 2,
   'Two sessions missed this week. Which one is the problem, the time or the plan?'),
  ('calf_above', 'Calf rating above threshold',
   '{"metric":"calf_rating","op":">"}'::jsonb, 5,
   'Calf is at {value}. Today is easy only, and tell me what it does tomorrow.'),
  ('back_actionable', 'Back discomfort above none',
   '{"metric":"back_status","op":"!=","value":"None"}'::jsonb, null,
   'Back is reading {value}. Skip anything loaded through the spine today.'),
  ('weight_stall', 'Weight flat for two weeks',
   '{"metric":"weight_7d_avg","op":"delta_under","window":"2w"}'::jsonb, 0.5,
   'Weight has not moved in two weeks. Calories come down {amount} from Monday.'),
  ('mileage_spike', 'Weekly mileage over the ramp',
   '{"metric":"weekly_mileage","op":"ramp_over","window":"3w"}'::jsonb, 10,
   'Mileage is {value} percent above the ramp. This week comes back down.'),
  ('no_checkin', 'Weekly check-in not submitted',
   '{"metric":"weekly_checkin","op":"missing"}'::jsonb, null,
   'No check-in this week. Two minutes when you get a moment.');

insert into public.message_templates (key, body, variables) values
  ('weekly_summary',
   'Weight is {weight_trend} on the week and adherence was {adherence}. {change_line} You have {session_today} today. {question}',
   '{weight_trend,adherence,change_line,session_today,question}'),
  ('missed_sessions',
   'Two sessions missed this week. {question}',
   '{question}'),
  ('milestone',
   '{milestone_name}. That is {number}. {question}',
   '{milestone_name,number,question}');

insert into public.milestones (key, name, description, category, threshold) values
  ('streak_7', 'Seven day streak', 'Seven scheduled days completed.', 'streak', 7),
  ('streak_14', 'Fourteen day streak', 'Fourteen scheduled days completed.', 'streak', 14),
  ('streak_30', 'Thirty day streak', 'Thirty scheduled days completed.', 'streak', 30),
  ('streak_60', 'Sixty day streak', 'Sixty scheduled days completed.', 'streak', 60),
  ('streak_90', 'Ninety day streak', 'Ninety scheduled days completed.', 'streak', 90),
  ('lost_5', 'First five pounds', null, 'weight', 5),
  ('lost_10', 'First ten pounds', null, 'weight', 10),
  ('lost_20', 'First twenty pounds', null, 'weight', 20),
  ('first_5k', 'First continuous 5K', null, 'running', 5),
  ('first_10k', 'First continuous 10K', null, 'running', 10),
  ('half', 'Half marathon', null, 'running', 21.1),
  ('full', 'Marathon', null, 'running', 42.2),
  ('e1rm_pr', 'New estimated one rep max', null, 'strength', null),
  ('sessions_25', 'Twenty five sessions', null, 'volume', 25),
  ('sessions_50', 'Fifty sessions', null, 'volume', 50),
  ('sessions_100', 'One hundred sessions', null, 'volume', 100),
  ('week_90', 'Ninety percent week', null, 'score', 90),
  ('program_midpoint', 'Program midpoint', null, 'program', null),
  ('program_complete', 'Program complete', null, 'program', null),
  ('retest', 'Retest done', null, 'program', null),
  ('race_done', 'Race done', null, 'running', null);

-- Per client triggers, drawn from the presets and pointed at the variable that
-- actually matters for each one.
insert into public.client_triggers (client_id, key, expression, threshold, suggested_message)
select c.id, tp.key, tp.expression, tp.default_threshold, tp.suggested_message
from public.clients c
cross join public.trigger_presets tp
where tp.key in ('steps_under', 'no_activity_72h', 'two_missed_sessions', 'no_checkin')
   or (tp.key = 'calf_above' and coalesce((c.flag_config ->> 'calf_watch')::boolean, false))
   or (tp.key = 'back_actionable' and coalesce((c.flag_config ->> 'spine')::boolean, false))
   or (tp.key = 'mileage_spike' and coalesce((c.feature_flags ->> 'running')::boolean, false))
   or (tp.key = 'weight_stall' and c.primary_goal = 'fat_loss');

-- Two forms per client. Daily under a minute, weekly on Sunday with fasted
-- weight as question one for everyone.
-- ---------------------------------------------------------------------------
-- Races.
--
-- Three, across the two race prep clients, chosen so the seed exercises every
-- phase of race mode rather than only the far-off one:
--
--   Theo's tune-up half is twelve days out, which is inside a half marathon's
--   two week taper, so the taper path has a client in it.
--   Theo's marathon is on the last day of his eighteen week block, which is
--   the build path, and it is the second race in his diary, so whatever picks
--   the race has to pick the near one.
--   Aisha's half closes her fourteen week block.
--
-- Dated off each client's own program start, not off a fixed calendar, so the
-- seed still means the same thing next month.
-- ---------------------------------------------------------------------------

insert into public.races (client_id, name, race_date, distance_metres, goal_time_seconds, notes)
select c.id, 'Shamrock Half', c.program_start_date + 12, 21097, null,
       'Tune-up. Not a goal race, and the week around it does not change.'
from public.clients c where c.slug = 'theo-vance'
union all
select c.id, 'Portland Marathon', c.program_start_date + (c.program_length_weeks * 7 - 1),
       42195, 3 * 3600 + 30 * 60,
       'The one the whole block is for. Sub three thirty is the stated goal.'
from public.clients c where c.slug = 'theo-vance'
union all
select c.id, 'Peachtree Half', c.program_start_date + (c.program_length_weeks * 7 - 1),
       21097, 1 * 3600 + 52 * 60, null
from public.clients c where c.slug = 'aisha-nkemdirim';

insert into public.checkin_forms (client_id, kind, questions, schedule, auto_send)
select
  c.id,
  'daily',
  -- The keys src/lib/checkin/bank.ts uses. They were 'daily_session',
  -- 'daily_sleep' and so on, which belong to the question_bank table and match
  -- nothing in the module every screen actually renders from, so all eight
  -- seeded clients had check-in forms whose questions resolved to nothing.
  -- tests/unit/checkin-bank.test.ts holds these against the bank now.
  jsonb_build_array('session_done', 'sleep_hours', 'energy', 'steps'),
  jsonb_build_object('days', jsonb_build_array(0, 1, 2, 3, 4, 5, 6),
                     'time', coalesce(c.communication_prefs ->> 'reminder_time', '20:00')),
  true
from public.clients c;

insert into public.checkin_forms (client_id, kind, questions, schedule, auto_send, spine_variable)
select
  c.id,
  'weekly',
  jsonb_build_array('fasted_weight', 'adherence', 'biggest_win',
                    'biggest_struggle', 'the_one_thing'),
  jsonb_build_object('days', jsonb_build_array(0), 'time', '18:00'),
  false,
  null
from public.clients c;

commit;

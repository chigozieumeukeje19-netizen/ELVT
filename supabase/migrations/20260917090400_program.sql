-- ---------------------------------------------------------------------------
-- Program. Materialized per client. A template is a recipe; once applied the
-- rows below are the truth and the coach edits them freely.
-- ---------------------------------------------------------------------------

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  template_id uuid references public.program_templates (id) on delete set null,
  name text not null,

  -- Array of {name, start_week, end_week, color}
  phases jsonb not null default '[]'::jsonb,

  duration_weeks integer not null check (duration_weeks > 0),
  status text not null default 'draft' check (status in ('draft', 'active', 'complete', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index programs_client_idx on public.programs (client_id);

alter table public.programs enable row level security;

create table public.program_weeks (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  week_number integer not null check (week_number > 0),
  starts_on date not null,
  is_deload boolean not null default false,
  calories integer,
  protein integer,
  carbs integer,
  fat integer,
  calorie_note text,
  calorie_status text not null default 'projected' check (calorie_status in ('projected', 'confirmed', 'edited')),
  planned_mileage numeric(6, 2),

  -- Frozen copy of the week written at week roll. Prescribed versus actual has
  -- to survive later edits, so nothing here is recomputed afterwards.
  snapshot jsonb,

  elvt_score numeric(5, 2),
  adherence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, week_number)
);

create index program_weeks_client_idx on public.program_weeks (client_id, starts_on);

alter table public.program_weeks enable row level security;

create table public.program_days (
  id uuid primary key default gen_random_uuid(),
  program_week_id uuid not null references public.program_weeks (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  date date not null,
  day_of_week integer not null check (day_of_week between 0 and 6),
  is_rest boolean not null default false,
  calories_override integer,
  protein_override integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_week_id, date)
);

create index program_days_client_date_idx on public.program_days (client_id, date);

alter table public.program_days enable row level security;

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  program_day_id uuid not null references public.program_days (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  kind text not null check (kind in ('strength', 'run', 'mobility', 'conditioning', 'skill')),
  name text not null,
  "order" integer not null default 0,
  status text not null default 'planned' check (status in ('planned', 'done', 'modified', 'skipped')),
  started_at timestamptz,
  completed_at timestamptz,
  difficulty_rating integer check (difficulty_rating between 1 and 5),
  duration_min integer,
  fueling_notes text,
  coach_notes text,
  video_id text,

  -- True while the session still matches what the template produced. Re-applying
  -- a template only touches these, never a session the coach has edited.
  from_template boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sessions_day_idx on public.sessions (program_day_id);
create index sessions_client_status_idx on public.sessions (client_id, status);

alter table public.sessions enable row level security;

create table public.session_sections (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  type text not null default 'regular' check (type in ('regular', 'superset', 'circuit', 'amrap', 'interval')),
  "order" integer not null default 0,
  rounds integer,
  duration_sec integer,
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index session_sections_session_idx on public.session_sections (session_id);

alter table public.session_sections enable row level security;

create table public.session_exercises (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.session_sections (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  "order" integer not null default 0,

  -- Array of {set, reps, weight, pct_1rm, time, distance, rest, rpe, rir, tempo}.
  -- Per set targets are first class: 12, 10, 8, 6 is four entries, not a note.
  sets jsonb not null default '[]'::jsonb,

  tracking_fields text[] not null default '{reps,weight,rest}',
  notes text,
  rir_guidance text,
  substituted_from_exercise_id uuid references public.exercises (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index session_exercises_section_idx on public.session_exercises (section_id);

alter table public.session_exercises enable row level security;

create table public.set_logs (
  id uuid primary key default gen_random_uuid(),
  session_exercise_id uuid not null references public.session_exercises (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  set_number integer not null check (set_number > 0),

  -- The prescription is copied in beside the result and never updated after.
  -- This is what makes prescribed versus actual answerable months later.
  prescribed jsonb not null default '{}'::jsonb,
  actual jsonb not null default '{}'::jsonb,

  is_pr boolean not null default false,
  pr_type text check (pr_type in ('max_weight', 'max_volume', 'e1rm')),
  logged_at timestamptz not null default now(),

  -- Streaks and adherence count by the date the work was scheduled for, not by
  -- when the client got round to typing it in.
  logged_for_date date not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_exercise_id, set_number)
);

create index set_logs_client_date_idx on public.set_logs (client_id, logged_for_date);

alter table public.set_logs enable row level security;

create table public.runs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  run_type text not null check (run_type in ('easy', 'recovery', 'zone2', 'long', 'tempo', 'threshold', 'intervals', 'progression', 'hills', 'strides', 'race_pace', 'race', 'brick', 'walk_run', 'custom')),
  distance_target numeric(6, 2),
  duration_target integer,
  pace_min text,
  pace_max text,
  hr_min integer,
  hr_max integer,
  rpe_target integer check (rpe_target between 1 and 10),
  warmup text,
  workout_body jsonb not null default '{}'::jsonb,
  cooldown text,
  fueling jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index runs_session_idx on public.runs (session_id);

alter table public.runs enable row level security;

create table public.run_logs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  distance numeric(6, 2),
  duration integer,
  avg_pace text,
  avg_hr integer,
  max_hr integer,
  rpe integer check (rpe between 1 and 10),
  cadence integer,
  elevation numeric(7, 2),
  felt text check (felt in ('easy', 'ok', 'hard')),
  stayed_in_zone boolean,
  notes text,
  source text not null default 'manual' check (source in ('manual', 'strava', 'garmin', 'apple')),
  logged_for_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index run_logs_client_date_idx on public.run_logs (client_id, logged_for_date);

alter table public.run_logs enable row level security;

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  habit_id uuid references public.habits_library (id) on delete set null,
  name text not null,
  target numeric,
  unit text not null default 'check',
  days_of_week integer[] not null default '{0,1,2,3,4,5,6}',
  active_from date,
  active_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index habits_client_idx on public.habits (client_id);

alter table public.habits enable row level security;

create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  date date not null,
  value numeric,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (habit_id, date)
);

create index habit_logs_client_date_idx on public.habit_logs (client_id, date);

alter table public.habit_logs enable row level security;

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  program_week_id uuid references public.program_weeks (id) on delete set null,
  name text not null,
  "order" integer not null default 0,
  calories integer,
  protein integer,
  carbs integer,
  fat integer,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index meals_client_idx on public.meals (client_id);

alter table public.meals enable row level security;

create table public.meal_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  date date not null,
  meal_id uuid references public.meals (id) on delete set null,

  -- Direct entry for the amount actually weighed: name, kcal, p, c, f.
  -- Never per 100g maths on the client side.
  custom jsonb,

  source text not null default 'plan_tick' check (source in ('plan_tick', 'custom', 'barcode')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index meal_logs_client_date_idx on public.meal_logs (client_id, date);

alter table public.meal_logs enable row level security;

-- One row per client per day. The daily check-in writes here, and metric type
-- answers on any form land here too so a weight typed into a check-in shows up
-- on the weight chart without a second write path.
create table public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  date date not null,
  weight numeric(6, 2),
  steps integer,
  water numeric(7, 2),
  sleep_hours numeric(4, 2),
  energy integer check (energy between 1 and 10),
  mood integer check (mood between 1 and 10),
  readiness integer check (readiness between 1 and 100),
  session_status text check (session_status in ('done', 'modified', 'no', 'rest')),
  custom jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, date)
);

alter table public.daily_logs enable row level security;

create table public.day_completion (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  date date not null,
  score numeric(5, 2) not null default 0,

  -- Array of {key, weight, done}. Rest days rescale so a perfect rest day is
  -- still 100.
  tasks jsonb not null default '[]'::jsonb,

  streak_after integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, date)
);

alter table public.day_completion enable row level security;

select public.install_standard_triggers('programs', 'program');
select public.install_standard_triggers('program_weeks', 'program_week');
select public.install_standard_triggers('program_days', null);
select public.install_standard_triggers('sessions', 'session');
select public.install_standard_triggers('session_sections', null);
select public.install_standard_triggers('session_exercises', null);
select public.install_standard_triggers('set_logs', 'set_log');
select public.install_standard_triggers('runs', null);
select public.install_standard_triggers('run_logs', 'run_log');
select public.install_standard_triggers('habits', null);
select public.install_standard_triggers('habit_logs', 'habit_log');
select public.install_standard_triggers('meals', null);
select public.install_standard_triggers('meal_logs', 'meal_log');
select public.install_standard_triggers('daily_logs', 'daily_log');
select public.install_standard_triggers('day_completion', 'day_completion');

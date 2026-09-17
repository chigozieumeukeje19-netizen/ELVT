-- ---------------------------------------------------------------------------
-- Library. Coach-owned building blocks. Not client scoped, so the client role
-- reads exercises (the app renders demos from them) and nothing else.
-- ---------------------------------------------------------------------------

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  aliases text[] not null default '{}',
  type text check (type in ('strength', 'cardio', 'stretching', 'plyometrics', 'powerlifting', 'olympic', 'strongman', 'mobility', 'conditioning')),
  primary_muscle text,
  secondary_muscles text[] not null default '{}',
  equipment text[] not null default '{}',
  level text check (level in ('beginner', 'intermediate', 'advanced')),
  pattern text check (pattern in ('squat', 'hinge', 'push_h', 'push_v', 'pull_h', 'pull_v', 'carry', 'core', 'lunge', 'rotation')),

  -- youtube_id, gif_url, video_url, thumb_url, source, verified_at.
  -- Phase 1 stores a YouTube id only. gif_url and video_url stay in the shape
  -- so the client app can prefer an inline loop the moment media lands,
  -- without a migration.
  media jsonb not null default jsonb_build_object(
    'youtube_id', null,
    'gif_url', null,
    'video_url', null,
    'thumb_url', null,
    'source', null,
    'verified_at', null
  ),

  cues text[] not null default '{}',
  default_fields text[] not null default '{reps,weight,rest}',
  unilateral boolean not null default false,
  is_custom boolean not null default false,
  owner_id uuid references auth.users (id) on delete set null,

  -- Set by the importer when a name could not be matched to an existing row.
  -- Drives the unmatched review screen in the Builder.
  needs_review boolean not null default false,
  review_note text,
  import_source text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Matching between library sources is by name plus aliases, so the name has to
-- be unique case-insensitively or the importer cannot dedupe reliably.
create unique index exercises_name_key on public.exercises (lower(name));
create index exercises_aliases_idx on public.exercises using gin (aliases);
create index exercises_needs_review_idx on public.exercises (needs_review) where needs_review;

alter table public.exercises enable row level security;

create table public.exercise_alternatives (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  alt_exercise_id uuid not null references public.exercises (id) on delete cascade,
  reason text not null check (reason in ('equipment', 'injury', 'level')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exercise_id, alt_exercise_id, reason),
  check (exercise_id <> alt_exercise_id)
);

alter table public.exercise_alternatives enable row level security;

-- This table is what makes a flagged client safe by construction rather than
-- by the coach remembering. The template applier and every swap list join
-- through it against clients.flag_config.
create table public.exercise_contraindications (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  flag_key text not null check (flag_key in ('elbow', 'knee', 'spine', 'shoulder', 'rib', 'achilles', 'hip', 'wrist', 'ankle', 'neck')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exercise_id, flag_key)
);

create index exercise_contraindications_flag_idx on public.exercise_contraindications (flag_key);

alter table public.exercise_contraindications enable row level security;

-- Template bodies stay as jsonb. They are recipes, not materialized rows, and
-- the shapes change often enough that columns would fight the builder.
create table public.section_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tags text[] not null default '{}',
  body jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tags text[] not null default '{}',
  goal_type text,
  body jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.run_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tags text[] not null default '{}',
  run_type text,
  body jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.program_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tags text[] not null default '{}',
  goal_type text,
  duration_weeks integer check (duration_weeks > 0),
  split text,
  body jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.section_templates enable row level security;
alter table public.workout_templates enable row level security;
alter table public.run_templates enable row level security;
alter table public.program_templates enable row level security;

create table public.habits_library (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null check (unit in ('check', 'steps', 'ml', 'oz', 'minutes', 'grams', 'hours', 'km', 'miles', 'calories', 'cups')),
  default_target numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.habits_library enable row level security;

create table public.question_bank (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  text text not null,
  type text not null check (type in ('text', 'number', 'multiple_choice', 'scale', 'yes_no', 'media', 'date', 'star', 'signature', 'photos', 'metric')),
  options jsonb not null default '[]'::jsonb,
  category text not null check (category in ('shared', 'steps', 'injury', 'nutrition', 'sleep', 'recovery', 'running', 'training', 'life', 'accountability', 'fit')),

  -- Goal types and flags this question applies to. The weekly generator filters
  -- the bank through this before proposing a form.
  applies_when jsonb not null default '{}'::jsonb,

  -- Which client variable this answer is allowed to change. The spine rule
  -- reads plan_changes for last Monday and pulls questions whose produces
  -- matches the variable that moved.
  produces jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index question_bank_category_idx on public.question_bank (category);

alter table public.question_bank enable row level security;

create table public.trigger_presets (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  expression jsonb not null default '{}'::jsonb,
  default_threshold numeric,
  suggested_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.trigger_presets enable row level security;

create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  body text not null,
  variables text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.message_templates enable row level security;

select public.install_standard_triggers('exercises', null, null);
select public.install_standard_triggers('exercise_alternatives', null, null);
select public.install_standard_triggers('exercise_contraindications', null, null);
select public.install_standard_triggers('section_templates', null, null);
select public.install_standard_triggers('workout_templates', null, null);
select public.install_standard_triggers('run_templates', null, null);
select public.install_standard_triggers('program_templates', null, null);
select public.install_standard_triggers('habits_library', null, null);
select public.install_standard_triggers('question_bank', null, null);
select public.install_standard_triggers('trigger_presets', null, null);
select public.install_standard_triggers('message_templates', null, null);

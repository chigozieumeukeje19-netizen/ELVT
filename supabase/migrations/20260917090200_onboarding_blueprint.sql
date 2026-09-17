-- ---------------------------------------------------------------------------
-- Onboarding and Blueprint.
-- The Blueprint is the approved document every AI job receives as context and
-- every generator reads before it writes, so it is versioned rather than
-- edited in place.
-- ---------------------------------------------------------------------------

create table public.questionnaires (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'intake' check (kind in ('intake', 'reassessment', 'custom')),
  sections jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.questionnaires enable row level security;

create table public.questionnaire_responses (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  questionnaire_id uuid not null references public.questionnaires (id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index questionnaire_responses_client_idx on public.questionnaire_responses (client_id);

alter table public.questionnaire_responses enable row level security;

create table public.blueprints (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  version integer not null default 1,
  status text not null default 'draft' check (status in ('draft', 'approved')),

  -- goals, duration, availability, running_experience, nutrition_structure,
  -- calorie_target, protein_target, step_goal, recovery_priorities,
  -- constraints, race_dates, medical, comm_prefs, one_thing, triggers,
  -- failure_mode, tone
  content jsonb not null default '{}'::jsonb,

  approved_at timestamptz,
  approved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, version)
);

create index blueprints_client_status_idx on public.blueprints (client_id, status);

alter table public.blueprints enable row level security;

select public.install_standard_triggers('questionnaires', null, null);
select public.install_standard_triggers('questionnaire_responses', 'questionnaire_response');
select public.install_standard_triggers('blueprints', 'blueprint');

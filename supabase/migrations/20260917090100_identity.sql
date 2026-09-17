-- ---------------------------------------------------------------------------
-- Identity: profiles and clients.
-- Carried over from the August rebuild (profiles.role, clients.slug,
-- program_start_date, program_length_weeks, calorie_target, flag_config) and
-- extended with everything Part 5 asks for.
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'client' check (role in ('client', 'coach', 'admin')),
  display_name text,
  email text not null,
  timezone text not null default 'UTC',
  avatar text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_email_idx on public.profiles (lower(email));
create index profiles_role_idx on public.profiles (role);

alter table public.profiles enable row level security;

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles (id) on delete set null,
  slug text not null unique,
  first_name text not null,
  last_name text,
  sex text check (sex in ('male', 'female', 'other', 'undisclosed')),
  dob date,
  height_cm numeric(5, 1),
  start_weight numeric(6, 2),
  goal_weight numeric(6, 2),
  units text not null default 'imperial' check (units in ('imperial', 'metric')),
  status text not null default 'onboarding'
    check (status in ('onboarding', 'pending_approval', 'active', 'paused', 'finished', 'archived')),
  program_start_date date,
  program_length_weeks integer check (program_length_weeks > 0),
  current_phase_id uuid,
  primary_goal text,
  goal_statement text,
  occupation text,
  location text,
  timezone text not null default 'UTC',
  calorie_target integer,

  -- tone, directness, reminder_time, preferred_channel
  communication_prefs jsonb not null default '{}'::jsonb,

  -- The contraindication switches. A true value here removes every exercise
  -- carrying the matching key from programs and from swap lists.
  flag_config jsonb not null default '{}'::jsonb,

  -- Per client feature control. A surface that is false disappears from the
  -- client app rather than showing an empty state.
  feature_flags jsonb not null default jsonb_build_object(
    'workouts', true,
    'running', true,
    'nutrition_tracker', true,
    'meal_plan', true,
    'steps', true,
    'water', true,
    'habits', true,
    'photos', true,
    'checkins', true,
    'messaging', true,
    'community', false
  ),

  one_thing text,
  coach_notes text,
  last_activity_at timestamptz,
  base44_user_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clients_status_idx on public.clients (status);
create index clients_profile_idx on public.clients (profile_id);

alter table public.clients enable row level security;

-- ---------------------------------------------------------------------------
-- Identity helpers. These read profiles and clients, so they are defined here
-- rather than in the foundation migration: a SQL language function is parsed
-- when it is created, and the tables have to exist by then.
-- ---------------------------------------------------------------------------

-- Reads the caller's role from profiles. SECURITY DEFINER so that a policy on
-- profiles can call it without recursing into its own RLS check.
create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.role from public.profiles p where p.id = auth.uid();
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.current_app_role() in ('coach', 'admin'), false);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.current_app_role() = 'admin', false);
$$;

-- Resolves the client id for the current session.
--
-- Two kinds of session reach this. A client who signed in to the portal with a
-- magic link has an auth user, so we look the client up by profile_id. A client
-- coming through Base44 carries a short lived JWT minted by
-- POST /api/v1/auth/exchange, which pins client_id as a claim. The claim is
-- checked against the clients table rather than trusted blindly, so a forged or
-- stale claim resolves to null and every client policy fails closed.
create or replace function public.current_client_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.id
  from public.clients c
  where c.profile_id = auth.uid()
     or c.id = nullif(
          nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'client_id',
          ''
        )::uuid
  limit 1;
$$;

select public.install_standard_triggers('profiles');
select public.install_standard_triggers('clients', 'client', 'id');

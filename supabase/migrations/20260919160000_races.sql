-- ---------------------------------------------------------------------------
-- Races.
--
-- The blueprint already carries a race date, because the intake asks for one.
-- It does not carry a distance or a goal time, and without a distance there is
-- no race pace, no taper length and no fueling plan: all three are functions of
-- how far and how long, not of a date.
--
-- So the coach fills this in once per race, and race mode reads it.
--
-- A client reads their own race and never writes one. The date a race is run on
-- is not theirs to move, and the taper and the checklist are computed from it.
-- ---------------------------------------------------------------------------

create table public.races (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  name text not null,
  race_date date not null,

  -- Metres, not miles. Every standard distance is defined in metres and the
  -- imperial numbers are the rounded ones, so storing miles would bake a
  -- rounding error into the only field the pace is divided by.
  distance_metres integer not null check (distance_metres > 0),

  -- Null when the goal is to finish, which is a real answer and not missing
  -- data. Race pace is null with it rather than invented.
  goal_time_seconds integer check (goal_time_seconds > 0),

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One race per client per day. Two entries for the same morning is a typo
  -- every time, and the countdown would have to pick one.
  unique (client_id, race_date)
);

create index races_client_date_idx on public.races (client_id, race_date);

alter table public.races enable row level security;

create policy races_staff on public.races
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy races_client_select on public.races
  for select to authenticated
  using (client_id = public.current_client_id());

select public.install_standard_triggers('races', 'race', 'client_id');

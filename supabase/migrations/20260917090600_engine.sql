-- ---------------------------------------------------------------------------
-- Engine. Triggers, the queue, the spine record, scoring and milestones.
-- ---------------------------------------------------------------------------

create table public.client_triggers (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  key text not null,
  expression jsonb not null default '{}'::jsonb,
  threshold numeric,
  active boolean not null default true,
  suggested_message text,
  last_fired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, key)
);

create index client_triggers_active_idx on public.client_triggers (client_id) where active;

alter table public.client_triggers enable row level security;

-- The attention queue. Everything the coach is asked to look at arrives here,
-- whatever produced it, so there is one place to open each day.
create table public.queue_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  kind text not null check (kind in ('trigger', 'retention_risk', 'checkin_due', 'checkin_submitted', 'approval', 'milestone', 'weight_flag', 'mileage_spike', 'monday_review')),
  severity integer not null default 3 check (severity between 1 and 5),
  title text not null,
  detail jsonb not null default '{}'::jsonb,
  suggested_action jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'done', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index queue_items_open_idx on public.queue_items (status, severity desc, created_at desc);
create index queue_items_client_idx on public.queue_items (client_id);

alter table public.queue_items enable row level security;

-- The spine record. Every change to a client's plan is one row, which is what
-- lets next week's check-in ask whether the change worked.
create table public.plan_changes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  week_number integer,
  field text not null,
  from_value text,
  to_value text,
  reason text,
  source text not null default 'coach' check (source in ('coach', 'ai_accepted', 'ai_edited', 'ai_draft', 'system')),
  status text not null default 'applied' check (status in ('draft', 'applied', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index plan_changes_client_week_idx on public.plan_changes (client_id, week_number desc);

alter table public.plan_changes enable row level security;

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  category text,
  threshold numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.milestones enable row level security;

create table public.client_milestones (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  milestone_id uuid references public.milestones (id) on delete cascade,
  custom_name text,
  achieved_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'sent', 'delivered')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index client_milestones_client_idx on public.client_milestones (client_id);

alter table public.client_milestones enable row level security;

create table public.celebrations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  client_milestone_id uuid references public.client_milestones (id) on delete cascade,
  headline text not null,
  number_shown text,
  shown_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.celebrations enable row level security;

-- A null client_id is the default row every client falls back to.
create table public.scoring_config (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients (id) on delete cascade,
  weights jsonb not null default jsonb_build_object(
    'training', 30,
    'run', 20,
    'calories', 15,
    'protein', 15,
    'steps', 10,
    'water', 5,
    'recovery', 5,
    'checkin', 5
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index scoring_config_client_idx on public.scoring_config (client_id) where client_id is not null;
create unique index scoring_config_default_idx on public.scoring_config ((client_id is null)) where client_id is null;

alter table public.scoring_config enable row level security;

-- Phase 2 surfaces. The shapes exist now so the engine never needs a migration
-- to start reading them.
create table public.wearable_samples (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  source text not null,
  metric text not null,
  value numeric,
  at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index wearable_samples_client_metric_idx on public.wearable_samples (client_id, metric, at desc);

alter table public.wearable_samples enable row level security;

create table public.client_xp (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.clients (id) on delete cascade,
  xp integer not null default 0,
  level integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.client_xp enable row level security;

-- Medical data sits in its own tables so it can be encrypted and audited
-- separately from everything else. Phase 2 adds the column encryption; the
-- separation and the audit trigger are in place from the start.
create table public.bloodwork_panels (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  drawn_on date not null,
  lab text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bloodwork_panels enable row level security;

create table public.bloodwork_markers (
  id uuid primary key default gen_random_uuid(),
  panel_id uuid not null references public.bloodwork_panels (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  marker text not null,
  value numeric,
  unit text,
  reference_low numeric,
  reference_high numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bloodwork_markers enable row level security;

create table public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  week_number integer,
  taken_on date not null,
  angle text not null check (angle in ('front', 'side', 'back')),
  storage_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index progress_photos_client_idx on public.progress_photos (client_id, taken_on desc);

alter table public.progress_photos enable row level security;

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  push_token text not null,
  platform text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, push_token)
);

alter table public.devices enable row level security;

select public.install_standard_triggers('client_triggers', 'client_trigger');
select public.install_standard_triggers('queue_items', 'queue_item');
select public.install_standard_triggers('plan_changes', 'plan_change');
select public.install_standard_triggers('milestones', null, null);
select public.install_standard_triggers('client_milestones', 'client_milestone');
select public.install_standard_triggers('celebrations', 'celebration');
select public.install_standard_triggers('scoring_config', null);
select public.install_standard_triggers('wearable_samples', null);
select public.install_standard_triggers('client_xp', null);
select public.install_standard_triggers('bloodwork_panels', 'bloodwork_panel');
select public.install_standard_triggers('bloodwork_markers', 'bloodwork_marker');
select public.install_standard_triggers('progress_photos', 'progress_photo');
select public.install_standard_triggers('devices', null);

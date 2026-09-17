-- ---------------------------------------------------------------------------
-- Check-ins and communication.
-- A check-in is not a form, it is the input to Monday's decision, so the form
-- itself records which variable it was built around.
-- ---------------------------------------------------------------------------

create table public.checkin_forms (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  kind text not null check (kind in ('daily', 'weekly', 'week1', 'reassessment')),
  questions jsonb not null default '[]'::jsonb,

  -- {days: [0..6], time: "20:00"} evaluated in the client's timezone.
  schedule jsonb not null default '{}'::jsonb,

  auto_send boolean not null default false,

  -- The variable that changed last Monday. The weekly generator pulls questions
  -- whose produces field matches it, so the next form asks whether the change
  -- worked.
  spine_variable text,

  generated_from_change_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index checkin_forms_client_kind_idx on public.checkin_forms (client_id, kind);

alter table public.checkin_forms enable row level security;

create table public.threads (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  subject text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index threads_client_idx on public.threads (client_id);

alter table public.threads enable row level security;

create table public.checkin_submissions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.checkin_forms (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  for_date date not null,
  answers jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  review_note text,

  -- Review turns into a thread rather than one way feedback, so the client can
  -- reply to what the coach wrote.
  thread_id uuid references public.threads (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (form_id, for_date)
);

create index checkin_submissions_client_idx on public.checkin_submissions (client_id, for_date desc);
create index checkin_submissions_pending_idx on public.checkin_submissions (client_id) where reviewed_at is null;

alter table public.checkin_submissions enable row level security;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  sender_id uuid references auth.users (id) on delete set null,
  body text,
  kind text not null default 'text' check (kind in ('text', 'voice', 'video', 'photo', 'file', 'system')),
  attachment_path text,
  scheduled_for timestamptz,
  sent_at timestamptz,
  read_at timestamptz,
  touchpoint boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index messages_thread_idx on public.messages (thread_id, created_at);
create index messages_client_idx on public.messages (client_id);

alter table public.messages enable row level security;

-- Counted per week on the roster. CoachRx sets one per client per week as the
-- floor; the roster shows the count so it is visible rather than remembered.
create table public.touchpoints (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  kind text not null check (kind in ('message', 'checkin_review', 'comment', 'consult', 'call', 'voice_note')),
  ref_id uuid,
  at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index touchpoints_client_at_idx on public.touchpoints (client_id, at desc);

alter table public.touchpoints enable row level security;

select public.install_standard_triggers('checkin_forms', 'checkin_form');
select public.install_standard_triggers('threads', null);
select public.install_standard_triggers('checkin_submissions', 'checkin_submission');
select public.install_standard_triggers('messages', 'message');
select public.install_standard_triggers('touchpoints', 'touchpoint');

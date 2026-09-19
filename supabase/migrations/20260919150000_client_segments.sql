-- ---------------------------------------------------------------------------
-- Saved segments.
--
-- A named set of filters, never a named list of clients. A list goes stale the
-- moment someone's adherence changes, and the whole point of a segment like
-- "low adherence and no check-in" is that its membership moves without anyone
-- maintaining it.
--
-- Coach only. There is no client policy at all: a segment is a view of the
-- roster, and a client has no roster.
-- ---------------------------------------------------------------------------

create table public.client_segments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  filters text[] not null default '{}',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name)
);

alter table public.client_segments enable row level security;

create policy client_segments_staff on public.client_segments
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

select public.install_standard_triggers('client_segments', null, null);

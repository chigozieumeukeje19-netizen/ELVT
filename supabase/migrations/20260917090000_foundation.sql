-- ---------------------------------------------------------------------------
-- ELVT OS foundation: extensions, shared helpers, audit_log and events.
--
-- Security posture for the whole schema:
--   * every table turns RLS on and starts with no policies, so the default is
--     deny-all for anon and authenticated;
--   * the coach and admin roles reach everything through is_staff();
--   * the client role reaches only rows whose client_id matches the client id
--     resolved from their session, via current_client_id();
--   * server code that needs to bypass all of this uses the service role.
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto" with schema extensions;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Keeps updated_at honest without every caller having to remember it.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Audit log. Every coach action against an audited table lands here.
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (action in ('insert', 'update', 'delete', 'select')),
  table_name text not null,
  row_id uuid,
  diff jsonb not null default '{}'::jsonb,
  at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index audit_log_table_row_idx on public.audit_log (table_name, row_id);
create index audit_log_at_idx on public.audit_log (at desc);

alter table public.audit_log enable row level security;

-- ---------------------------------------------------------------------------
-- Events. Every state change emits one. The Base44 app and any webhook
-- subscriber read from here, so the payload has to stand on its own.
-- ---------------------------------------------------------------------------

create table public.events (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  client_id uuid,
  payload jsonb not null default '{}'::jsonb,
  at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index events_client_at_idx on public.events (client_id, at desc);
create index events_type_idx on public.events (type);

alter table public.events enable row level security;

-- ---------------------------------------------------------------------------
-- Generic triggers
-- ---------------------------------------------------------------------------

-- Writes an audit_log row for any table it is attached to. Diffs updates down
-- to the keys that actually changed so the log stays readable.
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  old_json jsonb;
  new_json jsonb;
  changed jsonb;
  target uuid;
begin
  if tg_op = 'INSERT' then
    new_json := to_jsonb(new);
    changed := jsonb_build_object('new', new_json);
    target := (new_json ->> 'id')::uuid;
  elsif tg_op = 'UPDATE' then
    old_json := to_jsonb(old);
    new_json := to_jsonb(new);
    select coalesce(jsonb_object_agg(key, jsonb_build_object('from', old_json -> key, 'to', new_json -> key)), '{}'::jsonb)
      into changed
      from jsonb_each(new_json)
     where old_json -> key is distinct from new_json -> key
       and key not in ('updated_at');
    if changed = '{}'::jsonb then
      return new;
    end if;
    target := (new_json ->> 'id')::uuid;
  else
    old_json := to_jsonb(old);
    changed := jsonb_build_object('old', old_json);
    target := (old_json ->> 'id')::uuid;
  end if;

  insert into public.audit_log (actor_id, action, table_name, row_id, diff)
  values (auth.uid(), lower(tg_op), tg_table_name, target, changed);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Emits an events row. The event type is passed as a trigger argument, and the
-- client id is read from whichever column the table uses to carry it.
create or replace function public.emit_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  row_json jsonb;
  event_type text := tg_argv[0];
  client_column text := coalesce(tg_argv[1], 'client_id');
  resolved_client uuid;
begin
  if tg_op = 'DELETE' then
    row_json := to_jsonb(old);
  else
    row_json := to_jsonb(new);
  end if;

  begin
    resolved_client := (row_json ->> client_column)::uuid;
  exception when others then
    resolved_client := null;
  end;

  insert into public.events (type, client_id, payload)
  values (
    event_type || '.' || lower(tg_op),
    resolved_client,
    jsonb_build_object('table', tg_table_name, 'row', row_json)
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Convenience installer so each table only needs one line further down.
create or replace function public.install_standard_triggers(
  target_table text,
  event_type text default null,
  client_column text default 'client_id'
)
returns void
language plpgsql
as $$
begin
  execute format(
    'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
    target_table || '_set_updated_at', target_table
  );
  execute format(
    'create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row_change()',
    target_table || '_audit', target_table
  );
  if event_type is not null then
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.emit_event(%L, %L)',
      target_table || '_events', target_table, event_type, client_column
    );
  end if;
end;
$$;

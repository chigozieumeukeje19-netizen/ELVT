-- ---------------------------------------------------------------------------
-- Production hardening: get the internals out of the exposed API surface.
--
-- Supabase's cloud linter found what the local stack cannot show: six
-- SECURITY DEFINER functions in `public` were callable over the Data API at
-- /rest/v1/rpc/<name> by both `anon` and `authenticated`.
--
-- Four things were established by testing rather than assumed, and each one
-- changed the shape of this migration:
--
--   1. `revoke execute ... from anon, authenticated` does NOTHING. Postgres
--      grants EXECUTE to PUBLIC by default, and that grant is what the Data
--      API rides on. Only a revoke from PUBLIC removes it.
--
--   2. Revoking from PUBLIC breaks RLS. Every policy on this schema calls
--      is_staff() or current_client_id(), policy expressions are evaluated as
--      the querying user, and EXECUTE is checked there. A coach reading the
--      roster got `permission denied for function current_client_id`. So the
--      four identity helpers genuinely must stay callable by `authenticated`,
--      which the spec asked to be said out loud rather than left in place
--      quietly.
--
--   3. A trigger function needs no EXECUTE at fire time. Postgres checks that
--      privilege when the trigger is created. With EXECUTE revoked from
--      everyone, a write still wrote its audit_log and events rows. So the
--      trigger functions can be locked down completely.
--
--   4. Every policy in this schema targets `authenticated`. Not one targets
--      `anon` or PUBLIC, so `anon` needs none of these and loses all of them.
--
-- That leaves one answer that satisfies both the security goal and the linter:
-- move the internals OUT of `public`, which is the remedy Supabase's own
-- remediation note names. PostgREST exposes `public` and nothing else, so a
-- function in `private` is unreachable over HTTP while still being callable by
-- a policy. The helpers keep exactly the EXECUTE that RLS needs and lose the
-- HTTP surface entirely, rather than trading one for the other.
--
-- Moving is safe for what already exists: policies and triggers hold the
-- function's OID, not its name, so `alter function ... set schema` is
-- transparent to all 22 policy references and every installed trigger. What is
-- NOT transparent is a function body that names a sibling by its old schema,
-- so is_staff() and is_admin() are rewritten below.
--
-- A future migration writing `public.is_staff()` will fail loudly rather than
-- silently create a second copy. That is the intended outcome; write
-- `private.is_staff()`.
-- ---------------------------------------------------------------------------

create schema if not exists private;

comment on schema private is
  'Internals. Never exposed through PostgREST. RLS helpers and trigger '
  'functions live here so they are callable by a policy and not over HTTP.';

-- ---------------------------------------------------------------------------
-- The move
-- ---------------------------------------------------------------------------

alter function public.current_app_role() set schema private;
alter function public.is_staff() set schema private;
alter function public.is_admin() set schema private;
alter function public.current_client_id() set schema private;
alter function public.audit_row_change() set schema private;
alter function public.emit_event() set schema private;

-- ---------------------------------------------------------------------------
-- Bodies, rewritten for the new schema and for an empty search_path.
--
-- `search_path = ''` rather than `public, pg_temp`: the linter's second finding
-- is that a role-mutable search_path is a privilege escalation route on a
-- SECURITY DEFINER function, and the strict version of the fix is to resolve
-- nothing implicitly. pg_catalog is still searched implicitly, so built-ins and
-- casts keep working; everything else is qualified.
-- ---------------------------------------------------------------------------

create or replace function private.current_app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = auth.uid();
$$;

create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_app_role() in ('coach', 'admin'), false);
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_app_role() = 'admin', false);
$$;

create or replace function private.current_client_id()
returns uuid
language sql
stable
security definer
set search_path = ''
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

create or replace function private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
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

create or replace function private.emit_event()
returns trigger
language plpgsql
security definer
set search_path = ''
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

-- ---------------------------------------------------------------------------
-- The two the linter named for a mutable search_path. Neither is SECURITY
-- DEFINER, so neither is an escalation route today, but a function without a
-- pinned search_path is one `alter function ... security definer` away from
-- being one, and the fix costs nothing.
--
-- install_standard_triggers stays in `public` because migrations call it by
-- name and moving it would break every future caller for no security gain: it
-- is DDL that only the migration role can usefully run. It now points at the
-- moved trigger functions.
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.install_standard_triggers(
  target_table text,
  event_type text default null,
  client_column text default 'client_id'
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  execute format(
    'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
    target_table || '_set_updated_at', target_table
  );
  execute format(
    'create trigger %I after insert or update or delete on public.%I for each row execute function private.audit_row_change()',
    target_table || '_audit', target_table
  );
  if event_type is not null then
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function private.emit_event(%L, %L)',
      target_table || '_events', target_table, event_type, client_column
    );
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants.
--
-- The structural version rather than a list that has to be maintained: nothing
-- in either schema is executable by the Data API roles unless it is granted
-- back by name, and the default for anything added later is the same.
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;

alter default privileges in schema public
  revoke execute on functions from public, anon, authenticated;
alter default privileges in schema private
  revoke execute on functions from public, anon, authenticated;

-- `authenticated` needs the schema and the four identity helpers, because
-- every policy calls them and a policy expression runs as the querying user.
-- It gets nothing else. `anon` gets nothing at all: no policy in this schema
-- targets it, so it has never had a reason to call any of these.
grant usage on schema private to authenticated;

grant execute on function
  private.current_app_role(),
  private.is_staff(),
  private.is_admin(),
  private.current_client_id()
to authenticated;

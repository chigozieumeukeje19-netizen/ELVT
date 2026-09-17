-- ---------------------------------------------------------------------------
-- RLS checks. Each block switches identity the way PostgREST does (set the
-- role, set the JWT claims) and asserts what that identity can reach.
-- Any failed assertion raises, so a non-zero psql exit means a broken policy.
-- ---------------------------------------------------------------------------

\set ON_ERROR_STOP on

create or replace function pg_temp.assert(condition boolean, label text)
returns void language plpgsql as $$
begin
  if condition is not true then
    raise exception 'FAILED: %', label;
  end if;
  raise notice 'ok: %', label;
end;
$$;

-- ---------------------------------------------------------------------------
-- Anonymous reaches nothing. The RLS migration revokes the Data API grant back
-- off anon, so a signed out request is refused before any policy is consulted.
-- That is a harder stop than an empty result, so these assert the refusal.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  blocked boolean;
  tables text[] := array['clients', 'profiles', 'exercises', 'daily_logs',
                         'blueprints', 'queue_items', 'audit_log', 'events'];
begin
  foreach t in array tables loop
    blocked := false;
    set local role anon;
    perform set_config('request.jwt.claims', '{}', true);
    begin
      execute format('select count(*) from public.%I', t);
    exception when insufficient_privilege then
      blocked := true;
    end;
    reset role;
    perform pg_temp.assert(blocked, format('anon is refused on %s', t));
  end loop;
end;
$$;

do $$
declare
  nadia_client uuid;
  nadia_user uuid;
  theo_client uuid;
  coach_user uuid;
  visible int;
begin
  select c.id, c.profile_id into nadia_client, nadia_user
    from public.clients c where c.slug = 'nadia-brookes';
  select c.id into theo_client from public.clients c where c.slug = 'theo-vance';
  select p.id into coach_user from public.profiles p where p.role = 'coach' limit 1;

  -- -------------------------------------------------------------------------
  -- A client reaches their own rows and nothing belonging to anyone else.
  -- -------------------------------------------------------------------------
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', nadia_user, 'role', 'authenticated')::text, true);

  select count(*) into visible from public.clients;
  perform pg_temp.assert(visible = 1, 'client sees exactly one client row');

  select count(*) into visible from public.clients where id = nadia_client;
  perform pg_temp.assert(visible = 1, 'client sees their own client row');

  select count(*) into visible from public.clients where id = theo_client;
  perform pg_temp.assert(visible = 0, 'client cannot see another client');

  select count(*) into visible from public.blueprints;
  perform pg_temp.assert(visible = 1, 'client sees only their own approved blueprint');

  select count(*) into visible from public.profiles;
  perform pg_temp.assert(visible = 1, 'client sees only their own profile');

  select count(*) into visible from public.queue_items;
  perform pg_temp.assert(visible = 0, 'client cannot read the coach queue');

  select count(*) into visible from public.plan_changes;
  perform pg_temp.assert(visible = 0, 'client cannot read the spine record');

  select count(*) into visible from public.audit_log;
  perform pg_temp.assert(visible = 0, 'client cannot read the audit log');

  select count(*) into visible from public.events;
  perform pg_temp.assert(visible = 0, 'client cannot read the event stream');

  select count(*) into visible from public.client_triggers;
  perform pg_temp.assert(visible = 0, 'client cannot read their own thresholds');

  reset role;
end;
$$;

-- A client cannot write a log belonging to someone else. Kept in its own block
-- so the expected failure does not abort the rest.
do $$
declare
  nadia_user uuid;
  theo_client uuid;
  blocked boolean := false;
begin
  select c.profile_id into nadia_user from public.clients c where c.slug = 'nadia-brookes';
  select c.id into theo_client from public.clients c where c.slug = 'theo-vance';

  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', nadia_user, 'role', 'authenticated')::text, true);

  begin
    insert into public.daily_logs (client_id, date, steps)
    values (theo_client, current_date, 9000);
  exception when insufficient_privilege then
    blocked := true;
  end;

  reset role;
  perform pg_temp.assert(blocked, 'client cannot write a log against another client');
end;
$$;

-- A client can write their own log.
do $$
declare
  nadia_user uuid;
  nadia_client uuid;
  written int;
begin
  select c.id, c.profile_id into nadia_client, nadia_user
    from public.clients c where c.slug = 'nadia-brookes';

  -- Clear any row from an earlier run so the checks can be run repeatedly
  -- against the same database.
  delete from public.daily_logs where client_id = nadia_client and date = current_date;

  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', nadia_user, 'role', 'authenticated')::text, true);

  insert into public.daily_logs (client_id, date, steps, weight)
  values (nadia_client, current_date, 9000, 171.4);

  select count(*) into written from public.daily_logs
   where client_id = nadia_client and date = current_date;
  reset role;
  perform pg_temp.assert(written = 1, 'client can write their own daily log');
end;
$$;

-- The coach reaches every client.
do $$
declare
  coach_user uuid;
  visible int;
begin
  select p.id into coach_user from public.profiles p where p.role = 'coach' limit 1;

  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', coach_user, 'role', 'authenticated')::text, true);

  select count(*) into visible from public.clients;
  perform pg_temp.assert(visible = 8, 'coach sees all eight clients');

  select count(*) into visible from public.queue_items;
  perform pg_temp.assert(visible >= 0, 'coach can read the queue');

  select count(*) into visible from public.client_triggers;
  perform pg_temp.assert(visible > 0, 'coach can read client triggers');

  reset role;
end;
$$;

-- A Base44 session carries client_id as a JWT claim instead of an auth user.
-- The claim is resolved against the clients table, so a forged one fails shut.
do $$
declare
  nadia_client uuid;
  visible int;
begin
  select c.id into nadia_client from public.clients c where c.slug = 'nadia-brookes';

  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('role', 'authenticated', 'client_id', nadia_client)::text, true);

  select count(*) into visible from public.clients;
  perform pg_temp.assert(visible = 1, 'exchange token reaches exactly one client');

  perform set_config('request.jwt.claims',
    json_build_object('role', 'authenticated',
                      'client_id', '00000000-0000-0000-0000-0000000000ff')::text, true);

  select count(*) into visible from public.clients;
  perform pg_temp.assert(visible = 0, 'a forged client_id claim reaches nothing');

  reset role;
end;
$$;

-- The audit trigger records coach edits, and the events trigger emits.
do $$
declare
  nadia_client uuid;
  audit_rows int;
  event_rows int;
begin
  select c.id into nadia_client from public.clients c where c.slug = 'nadia-brookes';

  update public.clients set one_thing = 'Protein at breakfast, every day.'
   where id = nadia_client;

  select count(*) into audit_rows from public.audit_log
   where table_name = 'clients' and row_id = nadia_client and action = 'update';
  perform pg_temp.assert(audit_rows > 0, 'audit_log records the update');

  select count(*) into event_rows from public.events
   where client_id = nadia_client and type = 'client.update';
  perform pg_temp.assert(event_rows > 0, 'events records the update');
end;
$$;

select 'RLS checks passed' as result;

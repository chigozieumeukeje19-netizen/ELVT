-- ---------------------------------------------------------------------------
-- Shim conformance.
--
-- A shim that is more permissive than production is worse than no shim: it
-- reports green on code that cannot run. These assertions pin the places where
-- the real Supabase auth schema is stricter than a naive stand-in would be.
--
-- Every entry here exists because the looser version let a real bug through, or
-- because it is the same class of thing that did.
-- ---------------------------------------------------------------------------

\set ON_ERROR_STOP on

create or replace function pg_temp.assert(condition boolean, label text)
returns void language plpgsql as $$
begin
  if condition is not true then
    raise exception 'SHIM DIVERGENCE: %', label;
  end if;
  raise notice 'ok: %', label;
end;
$$;

-- True when a column is GENERATED ALWAYS ... STORED.
create or replace function pg_temp.is_generated(
  schema_name text, table_name text, column_name text
)
returns boolean language sql stable as $$
  select coalesce(a.attgenerated = 's', false)
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = schema_name
    and c.relname = table_name
    and a.attname = column_name
    and a.attnum > 0
    and not a.attisdropped;
$$;

do $$
begin
  -- The one that actually broke. auth.identities.email is computed from
  -- identity_data, so no insert may name it. The shim carried a plain text
  -- column, the seed wrote to it, and the whole thing passed locally and then
  -- failed on the real stack with SQLSTATE 428C9.
  perform pg_temp.assert(
    pg_temp.is_generated('auth', 'identities', 'email'),
    'auth.identities.email is a generated column'
  );

  -- Same class, found while fixing the first. Absent from the shim entirely.
  perform pg_temp.assert(
    pg_temp.is_generated('auth', 'users', 'confirmed_at'),
    'auth.users.confirmed_at is a generated column'
  );

  -- The columns GoTrue needs to exist for a seeded user to be able to sign in.
  -- A missing one here would show up as a login failure on the real stack
  -- rather than as a seed error.
  perform pg_temp.assert(
    (select count(*) = 5 from information_schema.columns
      where table_schema = 'auth' and table_name = 'users'
        and column_name in ('instance_id', 'aud', 'role',
                            'encrypted_password', 'email_confirmed_at')),
    'auth.users carries the columns GoTrue reads on sign in'
  );

  perform pg_temp.assert(
    (select count(*) = 4 from information_schema.columns
      where table_schema = 'auth' and table_name = 'identities'
        and column_name in ('provider_id', 'provider', 'identity_data', 'user_id')),
    'auth.identities carries the columns GoTrue reads on sign in'
  );

  -- The Data API roles. RLS is meaningless without them, and the policies
  -- reference them by name.
  perform pg_temp.assert(
    (select count(*) = 3 from pg_roles
      where rolname in ('anon', 'authenticated', 'service_role')),
    'the three Data API roles exist'
  );

  -- The token columns GoTrue scans into Go strings. Production declares them
  -- nullable with no default; the shim used to default them to empty string,
  -- and that single kindness hid a seed writing NULLs. Every user lookup then
  -- returned a 500 and nobody could sign in, while the whole suite passed.
  perform pg_temp.assert(
    (select count(*) = 0
       from pg_attribute a
       join pg_class c on c.oid = a.attrelid
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'auth' and c.relname = 'users'
        and a.attname in ('confirmation_token', 'recovery_token',
                          'email_change_token_new', 'email_change_token_current',
                          'email_change')
        and a.atthasdef),
    'auth.users token columns have no default, as in production'
  );

  -- pgcrypto lives in the extensions schema on Supabase, and the seed hashes
  -- passwords with it. A shim without it would fail at seed time rather than
  -- silently, but the assertion keeps the reason legible.
  perform pg_temp.assert(
    to_regprocedure('extensions.crypt(text, text)') is not null
      and to_regprocedure('extensions.gen_salt(text)') is not null,
    'extensions.crypt and gen_salt are available'
  );

  -- Service role bypasses RLS in production. A shim without this would make
  -- server side code look blocked when it is not.
  perform pg_temp.assert(
    (select rolbypassrls from pg_roles where rolname = 'service_role'),
    'service_role bypasses RLS'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- The generic guard.
--
-- Rather than listing known generated columns forever, this reports every
-- generated column in auth and public. The test that consumes it cross checks
-- the list against what the seed actually writes, so a new generated column
-- cannot quietly become the next 428C9.
-- ---------------------------------------------------------------------------
select
  n.nspname || '.' || c.relname || '.' || a.attname as generated_column
from pg_attribute a
join pg_class c on c.oid = a.attrelid
join pg_namespace n on n.oid = c.relnamespace
where a.attgenerated = 's'
  and a.attnum > 0
  and not a.attisdropped
  and n.nspname in ('auth', 'public')
order by 1;

-- ---------------------------------------------------------------------------
-- The storage stand-in.
--
-- Standing rule: a local stand-in must be no more permissive than production.
-- The photo policies key on the first segment of a path, so foldername() is the
-- piece that has to behave identically. A shim that kept the file name would
-- make [1] the client id here and the week folder in production, and every
-- client would be able to read every folder.
-- ---------------------------------------------------------------------------

do $$
begin
  perform pg_temp.assert(
    storage.foldername('abc/week-1/front-123') = array['abc', 'week-1'],
    'foldername returns the folders and drops the file name'
  );

  perform pg_temp.assert(
    (storage.foldername('abc/week-1/front-123'))[1] = 'abc',
    'the first segment is the client id'
  );

  perform pg_temp.assert(
    storage.foldername('nofolders') = '{}'::text[] or storage.foldername('nofolders') is null,
    'a path with no folders returns nothing rather than the file name'
  );

  -- The bucket itself is asserted in tests/sql/api_rls_checks.sql, not here.
  -- This file runs before the migrations, on purpose: it checks the stand-in,
  -- and the bucket is something a migration creates.

  perform pg_temp.assert(
    exists (
      select 1 from information_schema.columns
      where table_schema = 'storage' and table_name = 'objects' and column_name = 'bucket_id'
    ),
    'storage.objects carries bucket_id, which every policy filters on'
  );
end;
$$;

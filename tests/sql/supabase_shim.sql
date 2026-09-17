-- ---------------------------------------------------------------------------
-- A minimal stand-in for the pieces Supabase provides before the first
-- migration runs: the auth schema, the roles, auth.users and auth.uid().
--
-- This file is NOT a migration and never runs against a Supabase database. It
-- exists so the migrations can be applied to a plain Postgres and checked, and
-- so the RLS tests can switch identity without GoTrue.
-- ---------------------------------------------------------------------------

create schema if not exists auth;
create schema if not exists extensions;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator login noinherit;
  end if;
end;
$$;

grant anon, authenticated, service_role to authenticator;
grant usage on schema public to anon, authenticated, service_role;
grant usage on schema extensions to anon, authenticated, service_role;

-- Supabase grants the Data API roles on every new table in public. Mirroring
-- that here matters: the RLS migration revokes the anon grant back off, and
-- there would be nothing to revoke otherwise.
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;

-- Shaped to match the real GoTrue table closely enough that the same seed file
-- runs here and against Supabase unchanged.
create table if not exists auth.users (
  instance_id uuid default '00000000-0000-0000-0000-000000000000',
  id uuid primary key default gen_random_uuid(),
  aud varchar(255) default 'authenticated',
  role varchar(255) default 'authenticated',
  email varchar(255) unique,
  encrypted_password varchar(255),
  email_confirmed_at timestamptz,
  invited_at timestamptz,
  confirmation_token varchar(255) default '',
  confirmation_sent_at timestamptz,
  recovery_token varchar(255) default '',
  recovery_sent_at timestamptz,
  email_change_token_new varchar(255) default '',
  email_change varchar(255) default '',
  email_change_sent_at timestamptz,
  last_sign_in_at timestamptz,
  raw_app_meta_data jsonb not null default '{}'::jsonb,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  is_super_admin boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  phone text unique,
  phone_confirmed_at timestamptz,
  email_change_token_current varchar(255) default '',
  email_change_confirm_status smallint default 0,
  is_sso_user boolean not null default false,
  is_anonymous boolean not null default false
);

create table if not exists auth.identities (
  provider_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  identity_data jsonb not null,
  provider text not null,
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  email text,
  id uuid primary key default gen_random_uuid(),
  unique (provider_id, provider)
);

grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to authenticated, service_role;
grant select on auth.identities to authenticated, service_role;

-- Reads the caller's user id out of the JWT claims the way Supabase does.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.sub', true),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
    ),
    ''
  )::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', ''),
    'anon'
  );
$$;

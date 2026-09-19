-- ---------------------------------------------------------------------------
-- Accounts for the plain Postgres verifier ONLY.
--
-- This file never runs against a real Supabase. There, GoTrue creates every
-- account through its admin API in scripts/seed-auth.ts, because hand written
-- auth rows have broken sign in twice.
--
-- The verifier has no GoTrue, so the RLS checks need profiles and linked
-- clients from somewhere. This is that somewhere, and it sets every column
-- GoTrue would set, including the token columns that must be empty strings
-- rather than NULL. If this file and the real thing ever disagree, the real
-- thing wins and this is what is wrong.
-- ---------------------------------------------------------------------------

begin;

create temporary table seed_people (
  user_id uuid not null default gen_random_uuid(),
  email text not null,
  role text not null,
  display_name text not null
) on commit drop;

insert into seed_people (email, role, display_name) values
  ('coach@elvt.test', 'coach', 'Darren'),
  ('nadia.brookes@elvt.test',   'client', 'Nadia Brookes'),
  ('theo.vance@elvt.test',      'client', 'Theo Vance'),
  ('marcus.oyelaran@elvt.test', 'client', 'Marcus Oyelaran'),
  ('priya.raghavan@elvt.test',  'client', 'Priya Raghavan'),
  ('elena.marsh@elvt.test',     'client', 'Elena Marsh'),
  ('jonah.petrakis@elvt.test',  'client', 'Jonah Petrakis'),
  ('aisha.nkemdirim@elvt.test', 'client', 'Aisha Nkemdirim'),
  ('caleb-whitlock@elvt.test',  'client', 'Caleb Whitlock');

-- Every token column is an empty string, never NULL. GoTrue scans these into
-- Go strings and a NULL makes the whole row unreadable.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new,
  email_change_token_current, email_change,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  p.user_id,
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  p.email,
  null,
  now(),
  '', '', '', '', '',
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('display_name', p.display_name),
  now(),
  now()
from seed_people p;

insert into auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at
)
select
  p.user_id::text,
  p.user_id,
  jsonb_build_object(
    'sub', p.user_id::text,
    'email', p.email,
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  now()
from seed_people p;

insert into public.profiles (id, role, display_name, email, timezone)
select p.user_id, p.role, p.display_name, p.email, 'America/New_York'
from seed_people p;

-- Link the clients the same way seed-auth.ts does: slug is the email local
-- part with dots turned into dashes.
update public.clients c
   set profile_id = pr.id
  from public.profiles pr
 where pr.role = 'client'
   and c.slug = replace(split_part(pr.email, '@', 1), '.', '-');

commit;

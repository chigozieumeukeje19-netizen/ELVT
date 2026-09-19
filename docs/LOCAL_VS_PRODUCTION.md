# Where the local stand-in differs from the real stack

The Supabase containers cannot be pulled in the environment this project is
mostly built in, so the schema is verified against a plain Postgres with a shim
that recreates the parts of Supabase the migrations touch
(`tests/sql/supabase_shim.sql`).

That shim was, once, more permissive than production. `auth.identities.email`
is `GENERATED ALWAYS` in the real schema; the shim carried it as an ordinary
text column; the seed wrote to it; everything passed locally and then failed on
the real stack with `SQLSTATE 428C9`. A shim that is looser than production is
worse than no shim, because it reports green on code that cannot run.

This file lists every divergence known to date. `scripts/shim-conformance.sh`
asserts the ones that are fixed, and `tests/unit/shim-conformance.test.ts`
cross checks the seed against the database's own list of generated columns, so
the next one cannot repeat the trick.

## Fixed

| Divergence | Was | Now |
| --- | --- | --- |
| `auth.identities.email` | Plain text column | `GENERATED ALWAYS AS (lower(identity_data ->> 'email')) STORED`, and the seed no longer names it |
| `auth.users.confirmed_at` | Absent | `GENERATED ALWAYS AS (least(email_confirmed_at, phone_confirmed_at)) STORED` |
| `pgcrypto` | Created by the foundation migration | Installed by the shim before migrations, as Supabase does, so the migration's `if not exists` is the no-op it is in production |
| `auth.jwt()` | Absent | Present, so a policy reaching for the claims object is exercised locally |

## Known, not fixed

Nothing in the codebase depends on these yet. Each one would pass locally and
fail on the real stack the moment something did.

**Most of the auth schema is missing.** The shim has `users` and `identities`.
Production also has `sessions`, `refresh_tokens`, `mfa_factors`,
`mfa_challenges`, `mfa_amr_claims`, `audit_log_entries`, `instances`,
`flow_state`, `one_time_tokens` and the SAML and SSO tables. A future trigger,
foreign key or policy referencing any of them is untested here.

**The `storage` schema is absent entirely.** Block F needs per client buckets
and signed URLs for progress photos. None of that can be checked locally.

**PostgREST is not running.** Three consequences:

- `max_rows = 1000` in `supabase/config.toml` is not enforced, so a query that
  would be truncated in production returns everything here.
- Embedded resource syntax is only checked by the foreign key constraint name
  existing. `exercise_alternatives!exercise_alternatives_exercise_id_fkey` was
  verified to match the real constraint name, but PostgREST has never parsed it.
- The RLS tests set `request.jwt.claims` with `set_config` rather than having
  PostgREST set it. The claim shape matches; the mechanism does not.

**GoTrue is not running.** The seed writes `auth.users` and `auth.identities`
directly:

- Passwords are hashed with `extensions.crypt(pw, extensions.gen_salt('bf'))`,
  which defaults to bcrypt cost 6. GoTrue writes cost 10. Sign in still
  verifies because the cost is embedded in the hash, but the rows are not
  byte identical to what GoTrue would produce.
- `minimum_password_length` and `password_requirements` from `config.toml` are
  enforced by GoTrue on signup, not by the database. A seed password violating
  them inserts fine and only fails later, on a password change.

**Everything local runs as a superuser.** This is the largest untested gap and
the one most likely to bite on the first production deploy. `supabase db reset`
and the plain Postgres verifier both run as `postgres`, which is a superuser
locally but is not on a cloud project. Statements at risk:

- `create extension if not exists pgcrypto with schema extensions`
- `alter default privileges in schema public grant ...` (in the shim)
- `revoke all on public.<table> from anon` (in the RLS migration)
- `create role` (in the shim)

None of these have been run as a non superuser. The first `supabase db push`
to ELVT OS PROD is the first real test of them.

**`pg_cron` and `pg_net` are absent.** Spec Part 13 wants scheduled jobs for
the nightly trigger evaluation, the week roll, reminder dispatch and the
retention scan. None of that is built or testable yet.

**The realtime publication is absent.** Nothing subscribes to it yet.

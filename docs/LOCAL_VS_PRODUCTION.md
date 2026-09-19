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

## How the check runs

`scripts/db-conformance.sh` grades the assumptions in this file. When a real
Supabase auth schema is reachable it runs against **that**, not against the
shim, and prints `SOURCE: real auth schema`. On a machine with no Supabase it
falls back to the shim and says so.

That choice is the whole point. A shim graded against its own copy of the
answer is what let `auth.identities.email` through. Graded against production,
the same assertions become a statement about the real schema that fails the
moment it stops being true.

## Fixed

| Divergence | Was | Now |
| --- | --- | --- |
| `auth.identities.email` | Plain text column | `GENERATED ALWAYS AS (lower(identity_data ->> 'email')) STORED`, and the seed no longer names it |
| `auth.users.confirmed_at` | Absent | `GENERATED ALWAYS AS (least(email_confirmed_at, phone_confirmed_at)) STORED` |
| `pgcrypto` | Created by the foundation migration | Installed by the shim before migrations, as Supabase does, so the migration's `if not exists` is the no-op it is in production |
| `auth.jwt()` | Absent | Present, so a policy reaching for the claims object is exercised locally |

**Seeded accounts are created twice, on purpose.** `supabase/seed.sql` writes
auth.users rows with no password so the plain Postgres verifier has profiles
and clients to check RLS against. On a real stack `scripts/seed-auth.ts` then
deletes those and recreates the same people through GoTrue's admin API, which
is the only way to get rows GoTrue is guaranteed to accept. The password comes
from the environment in that script, so SEED_COACH_PASSWORD is the one source
of truth; the SQL used to carry its own copy that could drift.

## Three times the stand-in was kinder than production

Every one of these passed the whole suite locally and failed on the real stack.
They are the same bug wearing different clothes: a hand written auth row, and a
shim that forgave something production does not.

**`auth.identities.email` is GENERATED ALWAYS.** The shim had it as ordinary
text, the seed wrote to it, and `supabase db reset` failed with SQLSTATE 428C9.

**`auth.users.confirmed_at` is GENERATED ALWAYS.** Absent from the shim
entirely. Found while fixing the first; nothing had written to it yet.

**`auth.users` token columns are nullable with no default.** The shim defaulted
`confirmation_token`, `recovery_token`, `email_change_token_new`,
`email_change_token_current` and `email_change` to empty string. The seed left
them NULL, which the shim silently turned into `''` and production kept as
NULL. GoTrue scans those columns into Go strings, NULL is not a string, so
**every user lookup returned a 500**: no sign in, no admin list users, no seed.
The suite reported 75 passed throughout.

The fix is not a fourth patch. `supabase/seed.sql` no longer writes auth rows at
all. `scripts/seed-auth.ts` creates every account through GoTrue's admin API, so
no column can be wrong because GoTrue writes them. The plain Postgres verifier,
which has no GoTrue, gets its accounts from `tests/sql/test_accounts.sql`, which
is clearly marked as a stand-in and loses to the real thing in any disagreement.

Three guards, each shown to fail when the bug is put back:

- `scripts/verify-migrations.sh` refuses a build where any account has a NULL
  token column, naming the count.
- `tests/sql/shim_conformance.sql` asserts those columns have no default, so
  the mask cannot be reinstated.
- `scripts/seed-auth.ts` lists the accounts back and signs the coach in after
  seeding. A seed that leaves GoTrue unable to read its own rows fails.

## One host, or magic links do not work

A browser treats `localhost` and `127.0.0.1` as different origins. It treats a
bare domain and its `www` form as different origins too, and http and https as
different origins. A session cookie set on one is never sent to the other.

That is not a local quirk. It is the failure mode waiting on production: a
client taps a link on their phone, the callback writes their session on one
host, the next request goes to the other, no cookie arrives, and they land back
on the login page. The session is real and correct and nobody can see it.

Four values have to name the same origin for magic links to work at all:

| Value | Where |
| --- | --- |
| `site_url` | `supabase/config.toml`, and the Auth settings on the cloud project |
| `additional_redirect_urls` | same two places. One entry, not a list of hosts |
| `emailRedirectTo` | `src/app/client/login/page.tsx`, which uses the browser's own origin |
| The host clients actually reach | whatever Netlify serves |

Two things enforce it rather than trusting it:

- `scripts/e2e-preflight.sh` fails when `site_url` disagrees with the host the
  tests use, and fails again if `additional_redirect_urls` allows a second
  host. Both were verified by breaking them.
- `tests/e2e/helpers.ts` checks the `redirect_to` on the emailed link against
  the host the tests run on, and names both when they differ.

The app no longer depends on getting this right. `src/app/auth/callback/route.ts`
returns a **relative** Location, which the browser resolves against the origin
it is already on, so the callback can never move a client to a different host
than they arrived on. It used to build an absolute URL from
`new URL(request.url).origin`, which is the host the server thinks it is
serving, and that is what sent clients to `localhost` while their session sat
on `127.0.0.1`.

**Before ELVT OS PROD serves a client:** set `site_url` to the exact origin
Netlify serves, including the scheme and any `www`, set
`additional_redirect_urls` to that same origin only, and send yourself a magic
link from a phone before sending one to a client.

### Proving the host guards bite

The preflight guards were verified by breaking them, and both failed:

```
$ sed -i 's|127.0.0.1:3000|localhost:3000|' supabase/config.toml   # site_url
$ npm run e2e:preflight
Host mismatch.
  supabase/config.toml site_url : http://localhost:3000
  tests and E2E_HOST            : 127.0.0.1
exit 1

$ # additional_redirect_urls given a second host
$ npm run e2e:preflight
supabase/config.toml still allows a localhost redirect alongside 127.0.0.1.
exit 1
```

The two client magic link tests could not be broken on purpose here, because
this container has no GoTrue. That control needs the real stack, and it is one
command. It points the emailed link at a host the tests are not on, which is
the original bug:

```sh
cp supabase/config.toml /tmp/config.toml.bak

# site_url moves to localhost AND 127.0.0.1 leaves the allow list, so GoTrue
# refuses the emailRedirectTo the login form sends and falls back to site_url.
sed -i '' 's|^site_url = .*|site_url = "http://localhost:3000"|' supabase/config.toml
sed -i '' 's|^additional_redirect_urls = .*|additional_redirect_urls = ["http://localhost:3000/**"]|' supabase/config.toml

supabase stop && supabase start && npm run db:reset && npm run db:seed:auth
npm run build && npm run test:e2e:only -- tests/e2e/auth.spec.ts

# Expected: both client magic link tests fail with
#   "The magic link points at a different host than the tests run on."
# naming localhost and 127.0.0.1. Note that e2e:preflight is skipped on
# purpose here, since it refuses to let the run start at all.

cp /tmp/config.toml.bak supabase/config.toml
supabase stop && supabase start && npm run db:reset && npm run db:seed:auth
```

## The privilege question, which was a false lead

The `REVOKE` in `20260917090700_rls.sql` was suspected of breaking GoTrue and
was **not** responsible. The GoTrue log named the real cause, quoted above.

The audit still stands and is worth keeping: the migrations contain exactly one
privilege statement, `revoke all on public.<table> from anon`, scoped to tables
in `public` and to the `anon` role. Nothing in the eight migrations touches the
`auth` schema, and there is no `ALTER DEFAULT PRIVILEGES` or role change in any
of them. Applying all eight over a stand-in auth schema leaves its grants byte
identical.

The genuine risk that remains is unchanged: local and the verifier run
migrations as `postgres`, a superuser. ELVT OS PROD does not, and there is no
reset there. Run `npm run auth:diagnose` against a staging copy before any
`supabase db push`.

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

**JWT signing may differ on a cloud project.** The exchange endpoint mints
HS256 tokens signed with `SUPABASE_JWT_SECRET`, which is how a local stack
validates them. Supabase's newer key system allows a project to move to
asymmetric JWT signing keys, and a token signed with the legacy shared secret
would not be accepted there. Local is unaffected. Before ELVT OS PROD serves a
Base44 session, check which signing scheme that project uses; if it is
asymmetric, `src/lib/client-token.ts` needs to change. The end to end test
"the token it returns is scoped to one client at the RLS layer" is what proves
this path works, and it has not run yet.

**`pg_cron` and `pg_net` are absent.** Spec Part 13 wants scheduled jobs for
the nightly trigger evaluation, the week roll, reminder dispatch and the
retention scan. None of that is built or testable yet.

**The realtime publication is absent.** Nothing subscribes to it yet.

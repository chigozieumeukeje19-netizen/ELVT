# ELVT OS

The coaching portal. The portal is the brain; every client surface reads from
it through the API.

Source of truth for scope and sequence is `docs/ELVT_OS_PORTAL_SPEC.md`.

## Running the gate from a clean checkout

```bash
npm install

cp .env.example .env.local     # step one. Nothing runs without it.

supabase start                 # prints the values .env.local needs
supabase status                # print them again at any time
```

Fill four values in `.env.local` from `supabase status`:

| `.env.local` | `supabase status` line |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | API URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key, or Publishable key on a newer CLI |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key, or Secret key on a newer CLI |
| `SUPABASE_JWT_SECRET` | JWT secret |

Then generate the one secret that is yours to invent:

```bash
openssl rand -hex 32           # PORTAL_API_KEY
```

### Key formats

Both work. A newer CLI prints `sb_publishable_...` and `sb_secret_...`; an
older one prints JWTs starting `eyJ`. supabase-js sends either as the `apikey`
header and Supabase accepts both, so paste whichever yours shows.

`SUPABASE_JWT_SECRET` is a separate thing and the new key format does not
replace it. It signs the short lived client tokens
`POST /api/v1/auth/exchange` hands to Base44, and PostgREST validates them
against it. `npm run e2e:preflight` proves whichever keys you pasted are
actually accepted, rather than only that they are non blank.

### Then run it

```bash
npm run db:reset               # migrations, seed, then the accounts
npm run auth:smoke             # proves the coach can actually sign in
npm run test:e2e               # preflight, build, then Playwright
npm test                       # design audit, unit, schema and RLS
```

Use `npm run db:reset`, not `supabase db reset` on its own. The accounts are
created in a second step, through GoTrue's own admin API, because a hand
written auth.users row can be refused at sign in with no way to tell which
field was wrong. That is exactly what happened once: the seeded coach could
not sign in and the page could only say the credentials did not match.

`npm run auth:smoke` calls GoTrue's token endpoint directly and prints what is
in auth.users, the identities, the client links and the answer. Run it before
blaming the app: if it passes and the browser still fails, the problem is the
app, not the seed.

Sign in as the coach with `coach@elvt.test` and the password in
`.env.example`. Magic links sent locally never leave the machine; read them in
Inbucket at <http://127.0.0.1:54324>.

## Tests

```bash
npm run typecheck
npm test              # design audit, unit, schema and RLS
npm run test:e2e      # builds, then Playwright
```

`npm run test:e2e` builds first. A stale build serving old code is its own
class of wrong answer, and it has cost this project a debugging round already.
Use `npm run test:e2e:only` to skip the build while iterating.

### Database connection

Everything that talks to Postgres reads one setting, `ELVT_DB_URL`. It defaults
to the local Supabase stack:

```
postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

So on a machine with Supabase running, nothing needs setting. Confirm the port
with `supabase status` if a connection is refused.

On a machine with no Supabase and only a plain Postgres, point it at that
server:

```bash
export ELVT_DB_URL='postgresql://postgres@127.0.0.1:5433/postgres'
```

The schema and RLS scripts create a throwaway database on whatever server the
setting names, so they never touch the one Supabase is using.

```bash
npm run db:verify       # migrations and seed against a throwaway database
npm run db:conformance  # checks the local stand-in against the real schema
```

`db:conformance` runs against the **real** auth schema when one is reachable,
and only falls back to the shim when there is none. It prints which it used.
Checking the shim against a copy of itself is how a generated column got past
the whole suite once; checking it against production is the point.

## Environments

| Environment | Where | Notes |
| --- | --- | --- |
| Local | Supabase CLI and Docker | The only place Block A runs. Synthetic data only. |
| Preview | Netlify deploy previews | Free. Fine to use. |
| Production | ELVT OS PROD, Netlify production | Deploys cost credits. Only on sign off. |

There is exactly one cloud Supabase project, ELVT OS PROD, and nothing touches
it until a block has passed locally. The retired project
`Elvt Coaching app` is never linked, read or referenced; a test asserts its ref
appears nowhere in the repo.

## Auth email

Auth email goes through Resend's free tier over Supabase custom SMTP. The values
are env placeholders in `.env.example` and the `[auth.email.smtp]` block in
`supabase/config.toml` is commented out, so local development sends nothing and
magic links land in Inbucket. Fill the values in and uncomment the block to
enable it on production.

## AI

Every AI job in Part 10 of the spec ships as a "Generate prompt" button that
assembles the client's Blueprint and data into a copyable prompt, plus a "Paste
result" box that parses the reply into a draft for approval. The real API call
sits behind `AI_PROVIDER`, which is `off` by default, so a default install never
reaches a paid endpoint.

## Exercise media

Phase 1 is YouTube ids only, imported from the v1 client apps where every
movement was already vetted against a specific video. `gif_url` and `video_url`
are in the schema and stay empty until a media pass fills them.

```bash
npm run exercises:import -- --dir ../v1-archive --dry-run
npm run exercises:import -- --dir ../v1-archive
```

The import never guesses. Anything it cannot name, cannot find a video for, or
finds two different videos for lands on `/coach/builder/exercises/review`.

## House rules

- US English only.
- No dashes in any copy a client or coach reads. A test enforces both.
- No real client data outside production. The seed is eight invented people.

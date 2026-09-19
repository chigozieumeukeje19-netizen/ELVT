# ELVT OS

The coaching portal. The portal is the brain; every client surface reads from
it through the API.

Source of truth for scope and sequence is `docs/ELVT_OS_PORTAL_SPEC.md`.

## Getting started

```bash
npm install
cp .env.example .env.local
npm run db:start      # local Supabase via the CLI and Docker
npm run db:reset      # applies every migration, then seeds
npm run dev
```

`npm run db:start` prints the anon key and the service role key. Paste those
into `.env.local`, along with the JWT secret it prints, then generate the two
secrets of your own:

```bash
openssl rand -base64 48   # CLIENT_JWT_SECRET
openssl rand -hex 32      # PORTAL_API_KEY
```

Sign in as the coach with `coach@elvt.test` and the password in `.env.example`.
Magic links sent locally do not leave the machine; read them in Inbucket at
<http://127.0.0.1:54324>.

## Tests

```bash
npm run typecheck
npm test              # unit, plus schema and RLS against Postgres
npm run test:e2e      # Playwright
```

`scripts/shim-conformance.sh` asserts the local stand-in matches the real
Supabase schema where it matters. Read `docs/LOCAL_VS_PRODUCTION.md` before
trusting a local pass: it lists every known place the stand-in is looser than
production, including the ones not yet fixed.

The schema and RLS tests run against any Postgres, not just the Supabase stack.
Point them at one with `PGHOST`, `PGPORT` and `PGUSER`; they default to
`127.0.0.1:5433`. `scripts/verify-migrations.sh` applies every migration and the
seed to a throwaway database, and `scripts/rls-check.sh` runs the policy
assertions against it.

The Playwright tests that need Supabase Auth skip with a clear reason when it is
not running, so `npm run test:e2e` is still useful without the full stack.

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

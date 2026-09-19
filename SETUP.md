# Setup

A clean machine to a green suite, in order. Every command, and what each one is
for.

Four separate setup problems have cost a round each so far, and not one of them
was code: a missing env file, a missing JWT secret, a missing Playwright
browser, a missing test fixture. Each one now fails with a line telling you what
to run. This file is so you never see any of them.

---

## What you need first

| Thing | Why | Check |
|---|---|---|
| Node 20 or newer | Next 15 and the scripts | `node --version` |
| Docker Desktop, running | Supabase runs in it | `docker ps` |
| Supabase CLI | Postgres, GoTrue and PostgREST locally | `supabase --version` |
| `psql` | Every database check shells out to it | `psql --version` |

Docker has to be **running**, not just installed. `supabase start` fails with a
socket error if it is not, and that error does not mention Docker.

---

## 1. Install

```sh
npm install
npx playwright install chromium
```

`npx playwright install chromium` is the one people skip. Without it the end to
end run fails with "Executable doesn't exist" naming a revision, which looks
like a broken checkout rather than a missing download. On a machine that
already ships a Chromium, `playwright.config.ts` finds whichever revision is
installed under `PLAYWRIGHT_BROWSERS_PATH`; on a normal Mac, run the command.

---

## 2. Start the stack

```sh
npm run db:start        # supabase start, takes a minute the first time
npm run db:reset        # applies every migration, runs the seed, creates the auth accounts
```

`db:reset` is `supabase db reset` plus `db:seed:auth`. The second half matters:
the seed writes eight synthetic clients, and the auth accounts behind them are
created through GoTrue's API rather than by writing rows into a schema we do not
own. Without it nobody can sign in.

---

## 3. Write .env.local

```sh
cp .env.example .env.local
supabase status
```

`supabase status` prints the values. `.env.example` says which line maps to
which variable, including the two the newer CLI renames (`anon key` is now
`Publishable key`, `service_role key` is now `Secret key`; both formats work).

Three of them catch people out:

- **`SUPABASE_JWT_SECRET`** is not either of the two keys above and is not
  replaced by the new key format. It signs the short lived client tokens the
  exchange endpoint hands to Base44, and PostgREST validates against it. On a
  local stack it is the fixed value already in `.env.example`.
- **`PORTAL_API_KEY`** is yours to invent: `openssl rand -hex 32`.
- **`ELVT_DB_URL`** stays commented out unless you are on a machine with no
  Supabase. It defaults to the local stack.

Then prove they work rather than assuming:

```sh
npm run e2e:preflight
```

It checks every variable is set, that the keys are accepted rather than merely
present, that one host is used everywhere, and that nothing is holding ports
3000 or 3101. A key pasted from the wrong project is non blank and still wrong,
and this is the cheapest place to find that out.

---

## 4. The gate, in the order to run it

Each one is independent. Run them in this order the first time, because a
failure early on explains failures later.

```sh
npm run typecheck        # no emit, just types
npm test                 # design audit, then 700 unit tests
npm run db:verify        # every migration onto an empty database, then the seed
npm run db:conformance   # the local Supabase shim against the real schema
npm run db:api-rls       # 48 assertions, one per client API endpoint
npm run test:integration # 50 tests against real PostgREST with real rows
npm run loop:walk        # the nine step coaching loop, end to end
npm run test:e2e         # 353 browser tests, including 11 that really sign in
```

What each one is actually for:

- **`npm test`** runs the DESIGN.md audit first, so a design regression stops
  the run before the unit tests. Needs Postgres reachable: the schema, RLS,
  insert and shim suites read the live schema and **fail rather than skip**
  without it.
- **`db:verify`** applies the migrations to a throwaway database. It is the
  check that a migration works on an empty database rather than only on yours.
- **`db:api-rls`** is the one that matters most for a client's privacy. One
  assertion per endpoint, every one of them trying to reach a second client's
  rows.
- **`test:integration`** needs PostgREST. With the stack running it uses it. On
  a machine with no Docker, point `POSTGREST_BIN` at a
  [PostgREST binary](https://github.com/PostgREST/postgrest/releases) and it
  builds its own database. With neither it fails and names both, because a
  persistence test that quietly does not run reports a layer as covered.
- **`test:e2e`** builds the app, generates the client app fixture and starts two
  servers: one with the design preview routes on, one with them off, so the
  preview gate is proved closed rather than assumed closed.

Expect at the end of the e2e run:

```
AUTH COVERAGE: all 11 auth tests ran and passed.
Coach password sign in and client magic link are PROVED.
```

Anything else about auth coverage means the run proved nothing about signing in,
and the run fails.

---

## 5. Sign in

The seed accounts are in `.env.example`:

```
coach@elvt.test / ElvtCoach2026
nadia.brookes@elvt.test / ElvtClient2026
```

```sh
npm run dev
```

Then <http://127.0.0.1:3000/login>.

**Use 127.0.0.1, not localhost.** A browser treats them as different origins, so
a session cookie set on one is never sent to the other, and a magic link lands
on the origin the session is not on. `supabase/config.toml` pins `site_url` to
127.0.0.1 and the preflight refuses to start if anything disagrees.

Local mail goes to Inbucket at <http://127.0.0.1:54324>, which is where magic
links arrive.

---

## When something fails

Every one of these fails with the command to run. This table is for reading the
message you already have.

| What you see | What it means | What to run |
|---|---|---|
| `Something is already on 3000` | A dev server is still up | `lsof -ti:3000 \| xargs kill -9` |
| `The end to end run cannot start. Missing: tests/e2e/fixtures/client-app.html` | Fixture never generated | `npm run export:fixture`, or just `npm run test:e2e` |
| `Executable doesn't exist at .../chrome-headless-shell` | Browser never downloaded | `npx playwright install chromium` |
| `Cannot reach Postgres` | Stack is not up | `npm run db:start` |
| `.env.local is missing values for: ...` | Copy step skipped | `cp .env.example .env.local && supabase status` |
| `Host mismatch` | config.toml and the tests disagree | Fix `site_url` in `supabase/config.toml`, then `supabase stop && supabase start` |
| `No PostgREST, so the integration tests cannot run` | No stack and no binary | `npm run db:start`, or set `POSTGREST_BIN` |
| `AUTH COVERAGE: not one auth test was collected` | The run started but collected nothing, usually a dead server | Read the lines under it; they name the three causes |

Two diagnostics for when sign in specifically will not work:

```sh
npm run auth:smoke      # password grant and magic link against the running stack
npm run auth:diagnose   # what GoTrue thinks the config is
```

---

## The scheduled jobs

Nothing runs these automatically in development. Each one takes the instant it
is running for, so you can run them for any moment rather than waiting for one.

```sh
npm run week:roll                            # rolls any client whose local Sunday has ended
npm run nightly                              # the 21:00 trigger and retention scan
REMINDERS_AT=2026-10-05T11:05:00Z npm run reminders:dispatch
DISPATCH_AT=2026-10-05T13:05:00Z npm run messages:dispatch
```

---

## The rest

```sh
npm run ai:pack          # regenerates docs/ai-prompts from the real prompt builders
npm run export:fixture   # regenerates the client app fixture
npm run design:audit     # the DESIGN.md audit on its own
npm run exercises:import -- <dir>   # the v1 HTML files, once they exist
```

`docs/OPEN_QUESTIONS.md` is what the build is waiting on and what needs a
decision rather than a default. `docs/LOCAL_VS_PRODUCTION.md` is what differs
between a local stack and the cloud project.

## Before deploying

```
npm run deploy:dry-run
```

Builds the way the host builds, serves what comes out with a production-shaped
environment, and asks the running server the questions a first visitor asks. It
spends nothing. What it reports and what a deploy still needs from a person is
in docs/DEPLOY.md.

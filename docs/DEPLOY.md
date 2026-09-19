# Deploying ELVT OS

Run `npm run deploy:dry-run` first. It builds the way the host builds, serves
what comes out with a production-shaped environment, and asks the running
server the questions a first visitor asks. It ends in one of two states, and
they mean different things:

- **Repo checks** are facts about this repository. A failure is a bug and the
  fix is a commit.
- **Deploy blockers** are things a person has to supply or decide. A failure is
  not a bug, and the answer to "can this be deployed" is still no.

The dry run spends nothing. Production deploys on Netlify cost credits, which
is why auto publishing is off in `netlify.toml` and a deploy is promoted by
hand.

## What the dry run checks

| Check | Why it is there |
| --- | --- |
| Node major agrees between `netlify.toml` and CI | A repo tested on one major and built on another is one deploy from finding out why |
| `.env.local` is not committed | It holds the service role key |
| Every variable in `REQUIRED_ENV` is in `.env.example` | A deploy is configured by a person reading that file. A variable the code requires and the example omits is a 500 on the first request that touches it |
| `ENABLE_DESIGN_PREVIEW` is on no deploy surface | The preview routes render real components against fixtures. A live site must not serve them |
| `npm run build` | The host runs exactly this |
| `GET /login` is 200 | The door opens |
| `GET /coach/clients` signed out redirects | A 500 here is the shape of a missing key, not of a signed-out visitor |
| `GET /dev/preview/roster` is 404 | The flag test against a real server rather than a grep |
| `GET /api/v1/checkins` unauthenticated is 401 or 403 | The client API refuses with an answer rather than an error |

## The blockers, and what each one needs

### 1. Nothing runs the four scheduled jobs

This is the real one. Every automatic thing the product does is on the other
side of it:

| Job | What stops without it |
| --- | --- |
| `npm run week:roll` | Adherence is never computed. Every roster score stays where it was on the day the client started |
| `npm run nightly` | No trigger ever fires. No retention scan, no queue items from a quiet client |
| `npm run reminders:dispatch` | No client is reminded of anything |
| `npm run messages:dispatch` | Scheduled messages are written and never sent |

All four tick every few minutes and are idempotent by construction, so an
extra tick produces an empty plan and a late tick catches up. That makes them
easy to schedule and means the scheduler does not have to be precise.

It does have to exist, and choosing one is a cost decision rather than a
technical one:

- **GitHub Actions cron.** Already the pattern in this repo, and free on a
  public repository. On a private one the arithmetic matters: a tick every
  fifteen minutes is about 96 runs a day, and at roughly a minute each that is
  near 2900 minutes a month against a 2000 minute free allowance. Every
  twenty minutes fits inside a paid tier comfortably and is still well inside
  every job's lateness window. Actions cron is also routinely delayed by ten
  minutes or more, which these jobs tolerate and a precise schedule would not.
- **Netlify scheduled functions.** Same host as the site, so one place to
  look. Needs the jobs wrapped as functions rather than run as npm scripts,
  and runs count against the host's own quota.
- **Supabase `pg_cron` plus an HTTP call.** Closest to the data and the
  cheapest to run. Needs the jobs exposed as authenticated endpoints, which
  means the service role key moves from a runner into the database.

Nothing here picks one, because the answer depends on what the project is
paying for. Whichever it is, the dry run looks for a workflow or a host config
that runs those four scripts, so wiring one turns the blocker green.

A scheduler that finds its secrets missing must fail loudly. A job that exits
zero because it had no credentials is a day where no client was reminded and
nothing said so.

### 2. Production values on the host

The dry run cannot know these and does not pretend to. Set them where the host
keeps its environment, from `.env.example`:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — server side only, never in a browser bundle
- `SUPABASE_JWT_SECRET` — signs the short lived tokens the exchange endpoint
  hands out, and is not either of the two keys above
- `PORTAL_API_KEY` — the shared secret the client app sends to the exchange
  endpoint
- `AI_PROVIDER` — leave at `off` unless there is a paid account behind it

`supabase/config.toml`'s `site_url` has to be the deployed origin. A magic link
signed for one origin does not carry a session to another, and the symptom is a
login that appears to work and lands signed out.

## Order

1. `npm test` and `npm run test:e2e` green. See SETUP.md.
2. `npm run deploy:dry-run` green.
3. Migrations applied to the production project.
4. Environment set on the host.
5. A scheduler for the four jobs.
6. Promote the deploy by hand.

# SCHEDULER SPEC: item 36

Clears the first deploy blocker from `scripts/deploy-dry-run.sh`: nothing runs
the four scheduled jobs.

## THE DECISION, AND WHY

The scheduler runs from Supabase, using `pg_cron` to wake up and `pg_net` to
call a protected endpoint on the portal. The portal does the work, as it does
today.

Rejected, with reasons worth recording so this is not reconsidered:

* GitHub Actions cron. The `schedule` event is explicitly best effort. There are
  widespread reports of runs firing 15 to 41 minutes late or never firing at all
  on private repositories, and GitHub automatically disables scheduled workflows
  in repositories with no commit activity for 60 days. A job that must fire at
  23:59 in a client's timezone cannot sit on that, and a scheduler that silently
  stops after two quiet months is exactly the failure mode this project keeps
  designing against.
* Netlify scheduled functions. Plausible, but it ties the scheduler to the host
  and its credit accounting, and hosting is the thing most likely to change.

Two useful consequences of the choice: the scheduler survives a host migration
untouched, and the project is never idle for 7 days, so the free tier pause
problem and the keepalive workflow both go away.

## 36.1 The endpoint

One route, `POST /api/internal/tick`.

* Authenticated by a shared secret in a header, compared in constant time, read
  from `SCHEDULER_SECRET`. Not the portal API key, not the service role key, its
  own value.
* Returns 401 on a bad or missing secret, with the same answer for both.
* Body names which job to run, or runs all four when absent: week roll,
  triggers, reminders, messages.
* Responds with what it did: per job, how many clients were due, how many
  writes, how many skipped as already done.
* Idempotent. It will be called more than once for the same hour, because
  retries exist and because a human will curl it. Every job already carries
  write keys, so lean on those rather than adding a lock.
* Never in the browser bundle, never reachable without the secret, and excluded
  from any sitemap or route listing.

## 36.2 The cadence

Hourly, on the hour, in UTC. Each job already computes which clients are due in
their own local time, so the cron itself needs no timezone logic. Confirm that
is true for all four rather than assuming it, and say so in the report.

One thing to check and fix if wrong: a job whose local target is 23:59 must
still fire when the scheduler wakes at the top of the hour. If any job requires
minute precision to be correct, widen its window rather than increasing the cron
frequency.

## 36.3 The migration

A migration that enables `pg_cron` and `pg_net`, then schedules the hourly call.

* The secret must not be written into the migration. Read it from a settings
  table or Supabase Vault, and say which you chose and why.
* Guard for re-runs: scheduling the same job twice must not produce two crons.
* Local is the same as production here, so this is testable before it ships.
  Prove it: schedule it locally, confirm the endpoint is called, confirm a
  second call in the same hour writes nothing.

## 36.4 Visibility

A scheduler nobody watches is a scheduler that has already stopped.

* Every tick writes an event recording which jobs ran and what they did
* `cron.job_run_details` is queryable, so document the one query that answers
  "did it run"
* The deploy preflight gains a check: the cron exists, is active, and has a
  successful run in the last two hours. If it has not run, that is a failure
  with the query to diagnose it.
* A tick that throws must still record that it was attempted

## 36.5 The runbook

`docs/DEPLOY.md` gains a scheduler section: what to set, in what order, how to
verify it fired, how to run a job by hand, and how to pause it. The order
matters and must be stated: the endpoint needs the deployed URL, so the cron is
configured after the first deploy, not before.

## 36.6 Controls

Prove each bites, then restore:

* A wrong secret is refused
* A missing secret is refused with the same answer as a wrong one
* A second tick in the same hour writes nothing
* The preflight check fails when the cron is absent, and fails when the cron
  exists but has not run

## NOT IN THIS ITEM

Push delivery still does not exist. The reminder dispatcher writes an event and
stops, because sending needs a paid service. This item makes the dispatcher run
on time. It does not make a phone buzz. Keep that distinction clear in the
report so nobody thinks reminders are live.

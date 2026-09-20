# PRODUCTION HARDENING SPEC: item 37

The 12 migrations pushed cleanly to ELVT OS PROD (`hazkfzjvfcgzosqncphm`). 53
tables, RLS enabled on every one, zero rows. The non-superuser difference did
not bite.

Supabase's security linter then found things the local stack cannot show. No
errors, three warning classes, two of which are real.

## THE FINDINGS

### 37.1 SECURITY DEFINER functions exposed over REST (the one that matters)

Six functions in `public` run as `SECURITY DEFINER` and are callable by both
`anon` and `authenticated` through `/rest/v1/rpc/<name>`:

`audit_row_change`, `emit_event`, `current_app_role`, `current_client_id`,
`is_admin`, `is_staff`

Two of those are the actual problem. `emit_event` and `audit_row_change` are
trigger functions. Nothing should ever call them directly, and as it stands
anyone holding the publishable key can call them over HTTP and write arbitrary
rows into `events` and `audit_log`. An audit log a stranger can write to is not
an audit log.

The four RLS helpers are lower risk, since they only report the caller's own
identity, but they are internals and have no reason to be in the exposed API
surface.

Fix: `revoke execute` on all six from `anon` and `authenticated`, in a new
migration. Trigger functions do not need execute granted to anyone, and the RLS
helpers are called by policies running as the definer rather than by the client.
Confirm that is true for each one before revoking rather than assuming it, and
if any helper genuinely needs to be callable, say which and why instead of
leaving the grant in place quietly.

Also add `revoke execute on all functions in schema public from anon,
authenticated` plus an `alter default privileges` equivalent, so a future
function is not exposed by default. That is the structural version of the fix
rather than a list that has to be maintained.

### 37.2 Mutable search path

`set_updated_at` and `install_standard_triggers` have a role-mutable
`search_path`, which is a known privilege escalation pattern for
`SECURITY DEFINER` functions.

Fix: `set search_path = ''` on both and fully qualify every reference inside
them. Check every other function in the schema for the same thing while you are
there, not just the two the linter named.

### 37.3 Verify, do not assume

After the fix, the linter must come back clean of these three classes. State in
the report what it says.

### 37.4 The lesson, and the guard that follows

This is the third time production has shown something local could not. The
generated column, the null token column, and now the API-exposed function
grants. The pattern is consistent: the local stack is permissive in ways the
cloud is not, and each time the gap was invisible until something real was
pointed at it.

The deploy preflight should therefore run the linter, or its equivalent, rather
than only checking things we already thought of:

* Add a check that fails when any `SECURITY DEFINER` function in `public` is
  executable by `anon` or `authenticated`
* Add a check that fails when any function in `public` has a mutable search path
* Both must run against a target project, and both must fail loudly naming the
  function

Prove each bites by granting execute back on one function, confirming red, then
revoking.

Record in `docs/LOCAL_VS_PRODUCTION.md` that the cloud linter exists, what it
caught, and that it should be run after any migration that adds a function.

### 37.5 Ordering

These are warnings and nothing is live, so this does not block the deploy. But
it is cheap to fix now with an empty database and no users, and expensive to fix
later. Do it before the first Netlify deploy.

The migration will need pushing to production, which is another
`supabase db push`. Say so in the report so I run it rather than assuming it is
applied.

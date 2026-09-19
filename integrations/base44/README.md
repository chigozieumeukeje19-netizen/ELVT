# Base44 backend functions

Four functions to paste into Base44 when that build starts. Nothing here has
been connected to Base44: these are files, written against the portal's API as
it actually is, and nothing in this repository calls them.

## What each one is for

| Function | Called by | Does |
| --- | --- | --- |
| `elvtSession` | the app, once at sign in | Exchanges a Base44 identity for a short lived portal token |
| `elvtGet` | every read | Forwards a GET with the client's token |
| `elvtPost` | every write | Forwards a POST with the client's token |
| `elvtWebhook` | the portal | Tells the app something changed so it refetches |

## Secrets to set

Base44 holds these per app. None of them belongs in the browser.

| Secret | Used by | What it is |
| --- | --- | --- |
| `ELVT_PORTAL_URL` | all three forwarders | The portal's origin, no trailing slash. `https://elvt-os.example.com` |
| `ELVT_PORTAL_API_KEY` | `elvtSession` | The portal's `PORTAL_API_KEY`. This mints tokens for any client, so it never leaves the backend |
| `ELVT_WEBHOOK_SECRET` | `elvtWebhook` | A shared secret the portal sends as `x-elvt-signature` |

Generate the webhook secret rather than choosing one:

```sh
openssl rand -hex 32
```

## The shape of it

```
Base44 app (browser)
  |
  |  1. signs in with Base44 auth
  |  2. calls elvtSession, gets a portal token
  |  3. holds the token in session, nothing else
  v
Base44 backend functions  ──  ELVT_PORTAL_API_KEY lives here, only in elvtSession
  |
  v
ELVT portal /api/v1  ──  the token's client_id is enforced at the RLS layer
```

## Why it is built this way

**Base44 stores nothing but the token.** Every read and write goes to the
portal. Mirroring client data into Base44's own store is how the two drift
apart, and the way a client ends up reading yesterday's plan on a screen that
looks current.

**The API key only ever appears in `elvtSession`.** It can mint a token for any
client on the roster, so nothing that handles a request from the browser holds
it. The forwarders carry the client's own token and nothing more.

**The forwarders use an allow list, not a pass through.** The path arrives from
the browser. A function that forwards whatever it is handed will eventually be
handed `/auth/exchange`, and the allow list is what stops that being interesting
to try.

**Neither forwarder checks who owns what.** The portal validates every write
against the token's `client_id` at its row level security layer. A second check
here would be a second implementation of a rule that already holds, and the two
would drift. The one place that matters is `tests/sql/api_rls_checks.sql`, which
runs every endpoint against another client's row as PostgREST does.

**The webhook carries no state.** It says what changed and the app refetches. A
payload carrying the new data is a payload that can arrive out of order, and
pull to refresh has to work anyway because the portal is the truth.

**An unknown event is acknowledged, not refused.** A portal that has added an
event type is not an error, and answering with one makes it retry forever.

## Pasting them in

1. Create a backend function per file, named exactly as the file is.
2. Paste the contents. They are plain Deno with no imports, so there is nothing
   to install.
3. Set the three secrets above.
4. Give the portal `elvtWebhook`'s endpoint URL and the webhook secret.
5. Fill in the one commented line in `elvtWebhook` with however the app
   subscribes to changes. It is left blank because that depends on the app, and
   guessing it here would be a line someone has to find and delete.

## Checking it works without the app

```sh
# A session, using the portal API key.
curl -s -X POST "$BASE44_FUNCTIONS/elvtSession" \
  -H 'content-type: application/json' \
  -d '{"email":"client@example.com"}'

# A read, using the token that came back.
curl -s "$BASE44_FUNCTIONS/elvtGet?path=/today" \
  -H "authorization: Bearer $TOKEN"

# A write.
curl -s -X POST "$BASE44_FUNCTIONS/elvtPost" \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"path":"/daily-log","body":{"steps":8200}}'
```

A token lasts thirty minutes. The app calls `elvtSession` again rather than
refreshing, because a short token that is re-minted is simpler than a long one
that has to be revoked.

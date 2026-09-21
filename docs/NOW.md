# Now

What is being worked on, what is blocked, and where the seam with the other
developer is. Short by design: if it needs detail it belongs in a spec or in
`docs/OPEN_QUESTIONS.md`.

## Blocked on Darren

1. **`supabase db push` for the Block A migration.** Three migrations are
   built and verified locally against a clean database. Nothing is applied to
   ELVT OS PROD. See the command in `docs/DEPLOY.md`.
2. **The coach and the client are the same Postgres role.** Half of item 38.1
   cannot ship until this is decided. Recommendation and estimate at the top of
   `docs/OPEN_QUESTIONS.md`.
3. Production coach credentials, the Netlify site and its URL, the first client
   to migrate, the AI prompts, and the push delivery decision. Each is listed
   in the master queue under "the things only I can unblock".

## The seam with the other developer

He is taking the Base44 client app. This repository is the portal and the
client API it serves.

**Item 43, the Base44 identity fix, is his to lead** and he raised it. The
exchange endpoint currently takes an email plus a shared key and returns a
client-scoped token, so anyone holding the key can request a token for any
client. Nothing in this repository should assume a fix is in place until it is
agreed here.

What this side owns: `POST /api/v1/auth/exchange`, the token's claims and
lifetime, rate limiting on that endpoint, and the RLS that makes the token
mean something. What his side owns: how a Base44 session is established and
proved.

## Not started, deliberately

Everything in the master queue's deferred list. Wearables, barcode scanning,
recipes, community, challenges, advanced analytics. Not until Block D is done
and one real client has used the product for four weeks.

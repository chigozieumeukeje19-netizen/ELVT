import { expect, test } from "@playwright/test";

/**
 * What a deployed server answers.
 *
 * The other half of the deploy dry run. These run against the production build
 * served WITHOUT the preview flag, because the questions here are the ones a
 * first visitor asks and the answers differ when a key is missing.
 *
 * A Playwright project rather than a server the dry run starts itself: the
 * shell version leaked a next-server on every run, and the run after that was
 * silently answered by the stale one rather than by the build it had just
 * made. A removed preview gate still reported 404 that way, which is the exact
 * failure this file exists to catch.
 */

test("the door opens", async ({ request }) => {
  expect((await request.get("/login")).status()).toBe(200);
});

test("a signed out visitor is redirected, not shown a stack trace", async ({ request }) => {
  // A 500 here is the shape of a missing key, not of a signed out visitor.
  const response = await request.get("/coach/clients", { maxRedirects: 0 });
  expect([200, 302, 307]).toContain(response.status());
});

test("the design preview routes are not served", async ({ request }) => {
  // The flag test against a real server rather than a grep over config files.
  expect((await request.get("/dev/preview/roster")).status()).toBe(404);
});

test("the client API refuses an unauthenticated caller with an answer", async ({ request }) => {
  const response = await request.get("/api/v1/checkins");
  expect([401, 403]).toContain(response.status());
});

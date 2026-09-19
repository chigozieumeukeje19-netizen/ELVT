import { test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

export const COACH_EMAIL = process.env.SEED_COACH_EMAIL ?? "coach@elvt.test";
export const COACH_PASSWORD = process.env.SEED_COACH_PASSWORD ?? "ElvtCoach2026";

/** Two of the eight synthetic clients from the seed. */
export const CLIENT_EMAIL =
  process.env.SEED_CLIENT_EMAIL ?? "nadia.brookes@elvt.test";
export const CLIENT_NAME = "Nadia";

/**
 * A second client, so two tests can each request a magic link without tripping
 * GoTrue's per address frequency limit when they run in parallel.
 */
export const CLIENT_EMAIL_2 = "theo.vance@elvt.test";

/** Supabase CLI serves Mailpit here. No mail leaves the machine. */
export const MAILBOX_URL = process.env.MAILBOX_URL ?? "http://127.0.0.1:54324";

function supabaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
}

/** Is GoTrue answering? */
export async function authStackIsUp(): Promise<boolean> {
  const url = supabaseUrl();
  if (!url) return false;
  try {
    const res = await fetch(`${url}/auth/v1/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function missingAuthEnv(): string[] {
  return [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_JWT_SECRET",
    "PORTAL_API_KEY",
  ].filter((name) => !process.env[name]?.trim());
}

/**
 * The gate on every auth test.
 *
 * Skipping is allowed in exactly one situation: CI, which has no Supabase. On a
 * developer machine a missing stack is a failure, because these are the only
 * tests that prove anyone can sign in, and a skip there reads like a pass.
 */
export async function requireAuthStack(): Promise<void> {
  const missing = missingAuthEnv();
  if (missing.length > 0) {
    throw new Error(
      [
        "",
        "The auth tests cannot run. These are not set in the test process:",
        "",
        ...missing.map((name) => `  ${name}`),
        "",
        "playwright.config.ts loads .env.local. If that file has them and this",
        "still fails, the names do not match. Compare against .env.example.",
        "",
      ].join("\n"),
    );
  }

  if (await authStackIsUp()) return;

  const reason = [
    "",
    `Supabase Auth did not answer at ${supabaseUrl()}/auth/v1/health.`,
    "",
    "These eight tests are the only ones that sign anyone in, so the login",
    "flow is unproved without them. Start the stack:",
    "",
    "  supabase start",
    "  supabase db reset",
    "",
  ].join("\n");

  // CI has no stack and is not expected to. Everywhere else this is a failure.
  test.skip(Boolean(process.env.CI), reason);
  throw new Error(reason);
}

export function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// ---------------------------------------------------------------------------
// Mailpit
//
// There is no SMTP locally: config.toml leaves [auth.email.smtp] commented out,
// so GoTrue hands every message to Mailpit instead. Reading the link from there
// is the only way to test what a client actually does, because the link that
// arrives by email is the one carrying the PKCE code the callback route needs.
// ---------------------------------------------------------------------------

type MailpitMessage = { ID: string; To: { Address: string }[]; Created: string };

export async function clearMailbox(): Promise<void> {
  await fetch(`${MAILBOX_URL}/api/v1/messages`, {
    method: "DELETE",
    signal: AbortSignal.timeout(5000),
  }).catch(() => undefined);
}

async function mailpitReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${MAILBOX_URL}/api/v1/messages?limit=1`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Waits for the newest message to an address and pulls the confirmation link
 * out of it.
 */
/**
 * The link GoTrue emails carries a redirect_to. If its host is not the host the
 * tests run on, the session will be written on one origin and read on another,
 * and the client ends up back at the login page holding a session nobody can
 * see. Naming that here beats discovering it as a URL assertion three steps
 * later.
 */
function assertRedirectHost(link: string): void {
  const redirectTo = new URL(link).searchParams.get("redirect_to");

  // Not a soft pass. The login form always sends emailRedirectTo, so a link
  // without one means GoTrue rejected it and fell back to site_url, which is
  // exactly the wrong host this check exists to catch.
  if (!redirectTo) {
    throw new Error(
      [
        "",
        "The magic link carries no redirect_to.",
        "",
        "The login form always sends emailRedirectTo, so GoTrue refused it and",
        "fell back to site_url. That is a host the tests are not on.",
        "",
        "Check additional_redirect_urls in supabase/config.toml allows the host",
        "the tests use, then restart: supabase stop && supabase start",
        "",
      ].join("\n"),
    );
  }

  const linkHost = new URL(redirectTo).hostname;
  const expected = new URL(
    process.env.E2E_BASE_URL ?? `http://${process.env.E2E_HOST ?? "127.0.0.1"}:3000`,
  ).hostname;

  if (linkHost !== expected) {
    throw new Error(
      [
        "",
        "The magic link points at a different host than the tests run on.",
        "",
        `  link redirect_to : ${linkHost}`,
        `  tests run on     : ${expected}`,
        "",
        "A browser treats these as different origins, so the session cookie",
        "set by the callback will not be sent on the next request.",
        "",
        "Check site_url and additional_redirect_urls in supabase/config.toml,",
        "then restart: supabase stop && supabase start",
        "",
      ].join("\n"),
    );
  }
}

export async function magicLinkFromMailbox(
  email: string,
  timeoutMs = 15_000,
): Promise<string> {
  if (!(await mailpitReachable())) {
    throw new Error(
      [
        "",
        `Mailpit did not answer at ${MAILBOX_URL}.`,
        "",
        "Local magic links go there because there is no SMTP configured.",
        "Check the inbucket port in supabase/config.toml against",
        "`supabase status`, or set MAILBOX_URL.",
        "",
      ].join("\n"),
    );
  }

  const deadline = Date.now() + timeoutMs;
  const wanted = email.toLowerCase();

  while (Date.now() < deadline) {
    const res = await fetch(`${MAILBOX_URL}/api/v1/messages?limit=50`);
    const body = (await res.json()) as { messages?: MailpitMessage[] };

    const match = (body.messages ?? [])
      .filter((m) =>
        (m.To ?? []).some((to) => to.Address?.toLowerCase() === wanted),
      )
      .sort((a, b) => b.Created.localeCompare(a.Created))[0];

    if (match) {
      const detail = await fetch(`${MAILBOX_URL}/api/v1/message/${match.ID}`);
      const message = (await detail.json()) as { Text?: string; HTML?: string };
      const content = `${message.Text ?? ""}\n${message.HTML ?? ""}`;

      const link = content.match(
        /https?:\/\/[^\s"'<>]*\/auth\/v1\/verify[^\s"'<>]*/,
      )?.[0];

      if (link) {
        // Mailpit stores the HTML entity encoded form.
        const decoded = link.replace(/&amp;/g, "&");
        assertRedirectHost(decoded);
        return decoded;
      }

      throw new Error(
        `Found a message for ${email} but no verify link in it:\n${content.slice(0, 500)}`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  throw new Error(
    `No email arrived for ${email} at ${MAILBOX_URL} within ${timeoutMs}ms.`,
  );
}

// ---------------------------------------------------------------------------
// Sign in helpers
//
// These exist because the first real run reported "the page stayed at /login"
// when what had actually happened was GoTrue refusing the credentials and the
// page saying so. The assertion never looked at the error. These do, and they
// fail with what the server said.
// ---------------------------------------------------------------------------

import type { Page } from "@playwright/test";

/** Throws with the visible error text if the form reported one. */
async function failOnVisibleError(page: Page, what: string): Promise<void> {
  const alert = page.getByRole("alert");
  if ((await alert.count()) === 0) return;
  const text = (await alert.first().textContent())?.trim();
  if (text) {
    throw new Error(`${what} was refused. The page shows: ${text}`);
  }
}

export async function signInAsCoach(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(COACH_EMAIL);
  await page.getByLabel("Password").fill(COACH_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  // Whichever happens first: the queue, or an error worth reading.
  await Promise.race([
    page.waitForURL(/\/coach\/queue/, { timeout: 10_000 }),
    page.getByRole("alert").waitFor({ state: "visible", timeout: 10_000 }),
  ]).catch(() => undefined);

  await failOnVisibleError(page, `Coach sign in as ${COACH_EMAIL}`);
}

/** Requests a magic link through the real form and returns the link. */
export async function requestMagicLink(
  page: Page,
  email: string,
): Promise<string> {
  await page.goto("/client/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send my link" }).click();

  await Promise.race([
    page
      .getByRole("heading", { name: "Check your email" })
      .waitFor({ state: "visible", timeout: 10_000 }),
    page.getByRole("alert").waitFor({ state: "visible", timeout: 10_000 }),
  ]).catch(() => undefined);

  await failOnVisibleError(page, `Magic link for ${email}`);

  return magicLinkFromMailbox(email);
}

/**
 * Follows a magic link and records what actually happened to the session.
 *
 * Attaches the redirect chain and whether the callback set a cookie, so a
 * failure says where the session went rather than only where the browser ended
 * up. This is the evidence that separates "the cookie was never written" from
 * "the cookie was written on the wrong origin".
 */
export async function followMagicLink(
  page: Page,
  link: string,
  testInfo?: { attach: (name: string, options: { body: string; contentType: string }) => Promise<void> },
): Promise<void> {
  const chain: string[] = [];

  const record = (response: {
    status: () => number;
    url: () => string;
    headers: () => Record<string, string>;
  }) => {
    const headers = response.headers();
    const cookie = headers["set-cookie"];
    chain.push(
      [
        `${response.status()} ${response.url()}`,
        headers["location"] ? `  -> Location: ${headers["location"]}` : "",
        cookie ? `  -> Set-Cookie on ${new URL(response.url()).hostname}: ${cookie.split(";")[0].split("=")[0]}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  };

  page.on("response", record);
  try {
    await page.goto(link);
    await page.waitForLoadState("domcontentloaded");
  } finally {
    page.off("response", record);
  }

  if (testInfo) {
    await testInfo.attach("magic-link-chain.txt", {
      body: chain.join("\n"),
      contentType: "text/plain",
    });
  }

  // Kept on the error path so a failing run prints it without needing the
  // attachment.
  if (!page.url().includes("/client/today")) {
    throw new Error(
      [
        "",
        `The magic link did not end on /client/today. It ended on: ${page.url()}`,
        "",
        "Redirect chain, with the origin each cookie was set on:",
        "",
        ...chain.map((line) => `  ${line.replace(/\n/g, "\n  ")}`),
        "",
      ].join("\n"),
    );
  }
}

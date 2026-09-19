/**
 * Creates the seeded accounts through GoTrue's admin API.
 *
 * supabase/seed.sql writes auth.users rows so the plain Postgres verifier has
 * profiles and clients to check RLS against. Those rows are hand crafted, which
 * means guessing at everything GoTrue expects, and a row that looks right can
 * still be refused at sign in with no way to tell which field was wrong. That
 * is exactly what happened: the seeded coach could not sign in, and the page
 * could only say the credentials did not match.
 *
 * So on a real stack this deletes those rows and recreates the same people
 * through the API GoTrue itself uses. Whatever the hash cost, the identity
 * shape and the metadata are supposed to be, they are right by construction.
 *
 *   npm run db:reset        # supabase db reset, then this
 *   npm run db:seed:auth    # just this
 *
 * The password comes from the environment, so there is one source of truth for
 * it rather than a copy in SQL that can drift from .env.local.
 */

import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const COACH_PASSWORD = process.env.SEED_COACH_PASSWORD ?? "ElvtCoach2026";
const CLIENT_PASSWORD = process.env.SEED_CLIENT_PASSWORD ?? "ElvtClient2026";

type Person = {
  email: string;
  role: "coach" | "client";
  displayName: string;
  password: string;
};

const PEOPLE: Person[] = [
  {
    email: process.env.SEED_COACH_EMAIL ?? "coach@elvt.test",
    role: "coach",
    displayName: "Darren",
    password: COACH_PASSWORD,
  },
  // The eight synthetic clients. They sign in with a magic link in the gym,
  // but they carry a password too so a test can sign one in without waiting
  // on mail.
  ...[
    ["nadia.brookes@elvt.test", "Nadia Brookes"],
    ["theo.vance@elvt.test", "Theo Vance"],
    ["marcus.oyelaran@elvt.test", "Marcus Oyelaran"],
    ["priya.raghavan@elvt.test", "Priya Raghavan"],
    ["elena.marsh@elvt.test", "Elena Marsh"],
    ["jonah.petrakis@elvt.test", "Jonah Petrakis"],
    ["aisha.nkemdirim@elvt.test", "Aisha Nkemdirim"],
    ["caleb-whitlock@elvt.test", "Caleb Whitlock"],
  ].map(([email, displayName]) => ({
    email,
    role: "client" as const,
    displayName,
    password: CLIENT_PASSWORD,
  })),
];

/**
 * Stops the run and says so unmistakably.
 *
 * A seed that did not seed has to be an error. This printed a single line once
 * and the reset around it still read like it had worked, which meant nine
 * accounts with no password looked like a successful setup.
 */
function bail(message: string, hint?: string): never {
  const rule = "=".repeat(70);
  console.error("");
  console.error(rule);
  console.error("SEED FAILED. No accounts were created.");
  console.error(rule);
  console.error("");
  console.error(message);
  if (hint) {
    console.error("");
    console.error(hint);
  }
  console.error("");
  console.error(rule);
  console.error("");
  process.exit(1);
}

/**
 * GoTrue reporting a database error means it cannot read its own schema, which
 * is a different problem from anything about these accounts and needs saying
 * plainly rather than being reported as a seed failure.
 */
function schemaHint(message: string): string | undefined {
  if (!/database error/i.test(message)) return undefined;
  return [
    "GoTrue could not read its own schema. This is not an account problem.",
    "Something has taken away the access its database role needs.",
    "",
    "  npm run auth:diagnose",
    "",
    "Section 3 of that output names the auth table its role can no longer",
    "read. Until that is fixed, no account can be created or signed in.",
  ].join("\n");
}

async function main() {
  if (!URL || !SERVICE_KEY) {
    bail(
      [
        "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
        "",
        "  cp .env.example .env.local",
        "  supabase status",
      ].join("\n"),
    );
  }

  const admin = createClient(URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // One page is plenty for nine people, and this only ever runs against a
  // freshly reset local database.
  const { data: existing, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listError) {
    bail(`Could not list users: ${listError.message}`, schemaHint(listError.message));
  }

  const byEmail = new Map(
    existing.users.map((user) => [user.email?.toLowerCase(), user.id]),
  );

  for (const person of PEOPLE) {
    const previous = byEmail.get(person.email.toLowerCase());

    // profiles.id cascades from auth.users, and clients.profile_id is set null
    // on delete, so the client rows survive this and get relinked below.
    if (previous) {
      const { error } = await admin.auth.admin.deleteUser(previous);
      if (error) {
        bail(`Could not remove ${person.email}: ${error.message}`, schemaHint(error.message));
      }
    }

    const { data: created, error } = await admin.auth.admin.createUser({
      email: person.email,
      password: person.password,
      email_confirm: true,
      user_metadata: { display_name: person.displayName },
    });

    if (error || !created.user) {
      const message = error?.message ?? "no user returned";
      bail(`Could not create ${person.email}: ${message}`, schemaHint(message));
    }

    const { error: profileError } = await admin.from("profiles").upsert(
      {
        id: created.user.id,
        role: person.role,
        display_name: person.displayName,
        email: person.email,
        timezone: "America/New_York",
      },
      { onConflict: "id" },
    );
    if (profileError) {
      bail(`Could not write the profile for ${person.email}: ${profileError.message}`);
    }

    if (person.role === "client") {
      const { error: linkError } = await admin
        .from("clients")
        .update({ profile_id: created.user.id })
        .eq("slug", slugFor(person.email));
      if (linkError) {
        bail(`Could not link the client for ${person.email}: ${linkError.message}`);
      }
    }

    console.log(`  ${person.role.padEnd(6)} ${person.email}`);
  }

  // -------------------------------------------------------------------------
  // Verify, rather than assume.
  //
  // A seed that leaves GoTrue unable to read its own rows is not a successful
  // seed. Both of these read a user row, which is exactly the operation that
  // returned 500 for every account when one token column was NULL, so between
  // them they catch that whole class before anyone opens a browser.
  // -------------------------------------------------------------------------

  const { data: listed, error: verifyList } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });

  if (verifyList) {
    bail(
      `Accounts were created, but listing them back failed: ${verifyList.message}`,
      schemaHint(verifyList.message),
    );
  }

  const seededEmails = new Set(PEOPLE.map((p) => p.email.toLowerCase()));
  const found = listed.users.filter((u) =>
    seededEmails.has(u.email?.toLowerCase() ?? ""),
  );

  if (found.length !== PEOPLE.length) {
    bail(
      `Created ${PEOPLE.length} accounts but only ${found.length} read back.`,
      "GoTrue accepted the writes and cannot return them, which means the rows are not readable.",
    );
  }

  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anon) {
    bail(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY is not set, so sign in cannot be verified.",
      "Set it in .env.local from `supabase status`. A seed that cannot prove sign in works is not finished.",
    );
  }

  const client = createClient(URL, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const coach = PEOPLE[0];
  const { data: session, error: signInError } =
    await client.auth.signInWithPassword({
      email: coach.email,
      password: coach.password,
    });

  if (signInError || !session.session) {
    const message = signInError?.message ?? "no session returned";
    bail(
      `Seeded ${PEOPLE.length} accounts, but ${coach.email} cannot sign in.\nGoTrue said: ${message}`,
      schemaHint(message) ??
        "The accounts came from the admin API, so this is not a row shape problem. Check SEED_COACH_PASSWORD in .env.local.",
    );
  }

  console.log("");
  console.log(`  Listed back:   ${found.length} of ${PEOPLE.length} accounts`);
  console.log(`  Sign in:       verified for ${coach.email}`);

  console.log(`\nSeeded ${PEOPLE.length} accounts through GoTrue.`);
}

/** clients.slug is the email local part with dots turned into dashes. */
function slugFor(email: string): string {
  return email.split("@")[0].replace(/\./g, "-");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

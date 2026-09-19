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

function bail(message: string): never {
  console.error(`\n${message}\n`);
  process.exit(1);
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
  if (listError) bail(`Could not list users: ${listError.message}`);

  const byEmail = new Map(
    existing.users.map((user) => [user.email?.toLowerCase(), user.id]),
  );

  for (const person of PEOPLE) {
    const previous = byEmail.get(person.email.toLowerCase());

    // profiles.id cascades from auth.users, and clients.profile_id is set null
    // on delete, so the client rows survive this and get relinked below.
    if (previous) {
      const { error } = await admin.auth.admin.deleteUser(previous);
      if (error) bail(`Could not remove ${person.email}: ${error.message}`);
    }

    const { data: created, error } = await admin.auth.admin.createUser({
      email: person.email,
      password: person.password,
      email_confirm: true,
      user_metadata: { display_name: person.displayName },
    });

    if (error || !created.user) {
      bail(`Could not create ${person.email}: ${error?.message ?? "no user returned"}`);
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

  // Prove the coach can actually sign in, here, rather than finding out from a
  // browser later. This is the check that was missing.
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (anon) {
    const client = createClient(URL, anon, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const coach = PEOPLE[0];
    const { data, error } = await client.auth.signInWithPassword({
      email: coach.email,
      password: coach.password,
    });

    if (error || !data.session) {
      bail(
        [
          `Seeded ${PEOPLE.length} accounts, but ${coach.email} cannot sign in.`,
          `GoTrue said: ${error?.message ?? "no session returned"}`,
          "",
          "The accounts were created through the admin API, so this is not a",
          "seed shape problem. Check SEED_COACH_PASSWORD in .env.local.",
        ].join("\n"),
      );
    }
    console.log("");
    console.log(`Sign in verified for ${coach.email}.`);
  }

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

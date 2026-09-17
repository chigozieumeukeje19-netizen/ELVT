"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

function CoachLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const supabase = supabaseBrowser();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError("That email and password did not match. Try again.");
      setBusy(false);
      return;
    }

    router.push(params.get("next") ?? "/coach/queue");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="elvt-panel w-full max-w-sm p-6">
      <p className="elvt-label">ELVT OS</p>
      <h1 className="mt-2 text-2xl font-semibold">Coach sign in</h1>

      <label className="mt-6 block">
        <span className="elvt-label">Email</span>
        <input
          className="elvt-input mt-1"
          type="email"
          name="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>

      <label className="mt-4 block">
        <span className="elvt-label">Password</span>
        <input
          className="elvt-input mt-1"
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-gold">
          {error}
        </p>
      ) : null}

      <button className="elvt-button mt-6 w-full" type="submit" disabled={busy}>
        {busy ? "Signing in" : "Sign in"}
      </button>
    </form>
  );
}

export default function CoachLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <Suspense fallback={null}>
        <CoachLoginForm />
      </Suspense>
    </main>
  );
}

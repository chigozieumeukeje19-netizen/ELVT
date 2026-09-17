"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

/**
 * Clients sign in with a magic link. They are usually holding a phone in a gym,
 * so there is no password to remember and nothing to type twice.
 */
export default function ClientLoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const supabase = supabaseBrowser();
    const { error: linkError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/client/today`,
      },
    });

    if (linkError) {
      setError("We could not send that link. Check the email and try again.");
      setBusy(false);
      return;
    }

    setSent(true);
    setBusy(false);
  }

  if (sent) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5">
        <div className="w-full max-w-[320px]">
          <p className="elvt-label">ELVT</p>
          <h1 className="mt-1 text-section">Check your email</h1>
          <p className="mt-2 text-txt-mute">
            A sign in link is on its way to {email}. It works once and lasts an
            hour.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <form onSubmit={onSubmit} className="w-full max-w-[320px]">
        <p className="elvt-label">ELVT</p>
        <h1 className="mt-1 text-section">Sign in</h1>
        <p className="mt-2 text-txt-mute">
          Enter your email and we will send you a link.
        </p>

        <label className="mt-5 block">
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

        {error ? (
          <p role="alert" className="mt-4 text-flag">
            {error}
          </p>
        ) : null}

        <button className="elvt-button mt-5 w-full" type="submit" disabled={busy}>
          {busy ? "Sending" : "Send my link"}
        </button>
      </form>
    </main>
  );
}

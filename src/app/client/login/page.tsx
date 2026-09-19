"use client";

import { useCallback, useEffect, useState } from "react";
import { describeLinkFailure } from "@/lib/auth/link-errors";
import { supabaseBrowser } from "@/lib/supabase/browser";

/**
 * Clients sign in with a magic link. They are usually holding a phone in a gym,
 * so there is no password to remember and nothing to type twice.
 *
 * The confirmation screen keeps the form's error slot and a resend button on
 * purpose. Before it did, a client whose link never arrived had no way back:
 * the only control was the browser's back button, and a refused resend had
 * nowhere to be shown. GoTrue rate limits per address, so the request right
 * after a burst is exactly the one that gets refused, and it was refused
 * silently.
 */
export default function ClientLoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);

  // Counts the refusal down in front of the client rather than leaving them to
  // guess. Ticking to zero re-enables the button by itself.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const request = useCallback(async () => {
    setBusy(true);
    setError(null);

    const supabase = supabaseBrowser();
    const { error: linkError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // No query string. GoTrue matches redirect_to against its allow list,
        // and a bare path is one less thing for that match to get wrong. The
        // callback sends clients to Today by default.
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setBusy(false);

    if (linkError) {
      const failure = describeLinkFailure(linkError.message);
      setError(failure.message);
      if (failure.retryAfterSeconds) setCooldown(failure.retryAfterSeconds);
      return;
    }

    setSent(true);
  }, [email]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (cooldown > 0 || busy) return;
    await request();
  }

  const waiting = cooldown > 0;
  const blocked = busy || waiting;

  const errorSlot = error ? (
    <p role="alert" data-testid="login-error" className="mt-4 text-flag">
      {error}
    </p>
  ) : null;

  if (sent) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5">
        <div className="w-full max-w-[320px]" data-testid="screen-ready">
          <p className="elvt-label">ELVT</p>
          <h1 className="mt-1 text-h2">Check your email</h1>
          <p className="mt-2 text-txt-secondary">
            A sign in link is on its way to {email}. It works once and lasts an
            hour.
          </p>

          {errorSlot}

          <button
            className="elvt-button mt-5 w-full"
            type="button"
            data-testid="resend-link"
            disabled={blocked}
            onClick={() => void request()}
          >
            {waiting
              ? `Send another in ${cooldown}s`
              : busy
                ? "Sending"
                : "Send it again"}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-[320px]"
        data-testid="screen-ready"
      >
        <p className="elvt-label">ELVT</p>
        <h1 className="mt-1 text-h2">Sign in</h1>
        <p className="mt-2 text-txt-secondary">
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

        {errorSlot}

        <button className="elvt-button mt-5 w-full" type="submit" disabled={blocked}>
          {waiting ? `Try again in ${cooldown}s` : busy ? "Sending" : "Send my link"}
        </button>
      </form>
    </main>
  );
}

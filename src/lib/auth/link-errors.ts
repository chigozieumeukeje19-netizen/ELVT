/**
 * What went wrong when a magic link was requested, in words a client can act on.
 *
 * This exists because of a real failure: after a test run had burned through
 * several link requests, requesting one by hand appeared to do nothing. GoTrue
 * had refused it on its per-address rate limit, and the screen the client was
 * looking at had nowhere to put that answer. Silence reads as a broken app.
 *
 * GoTrue phrases the same refusal several ways depending on which limit was
 * hit and which version is running, so the matching is on substrings rather
 * than on a code, and anything unrecognised falls through with its own text
 * rather than being flattened into a generic apology.
 */

export type LinkFailure = {
  /** What the client reads. */
  message: string;
  /**
   * Seconds to wait before the request can succeed. Drives the countdown and
   * the disabled button, so a second press cannot look like it did nothing.
   */
  retryAfterSeconds: number | null;
  /** True when waiting is the whole fix. Used to pick the wording and the timer. */
  isRateLimit: boolean;
};

/**
 * GoTrue's per-address limit names its wait in the message and nowhere else,
 * so it is read back out of the text. Both phrasings seen in the wild:
 *   "For security purposes, you can only request this after 47 seconds."
 *   "For security purposes, you can only request this once every 60 seconds"
 */
function secondsFromMessage(raw: string): number | null {
  const match = raw.match(/(\d+)\s*seconds?/i);
  if (!match) return null;
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

export function describeLinkFailure(raw: string): LinkFailure {
  const text = raw.trim();
  const lower = text.toLowerCase();

  // The per-address limit. Common in normal use: a client taps the button
  // twice, or asks for a second link while the first is still in flight.
  if (lower.includes("for security purposes") || lower.includes("only request this")) {
    const seconds = secondsFromMessage(text);
    return {
      message: seconds
        ? `A link was just sent to this address. You can ask for another in ${seconds} seconds.`
        : "A link was just sent to this address. Wait a moment and try again.",
      retryAfterSeconds: seconds,
      isRateLimit: true,
    };
  }

  // The project wide hourly send limit. Waiting still fixes it, but not in
  // seconds, so no countdown is offered and the wording does not promise one.
  if (lower.includes("rate limit") || lower.includes("too many requests") || lower.includes("over_email_send_rate_limit")) {
    return {
      message:
        "Too many sign in emails have gone out in the last hour. Try again later, or ask your coach to send your link.",
      retryAfterSeconds: null,
      isRateLimit: true,
    };
  }

  // Not a limit. The redirect host is wrong, which is a configuration fault
  // and never something the client can wait out.
  if (lower.includes("redirect") && (lower.includes("not allowed") || lower.includes("invalid"))) {
    return {
      message:
        "This sign in page is not set up correctly, so the link could not be sent. Tell your coach.",
      retryAfterSeconds: null,
      isRateLimit: false,
    };
  }

  if (lower.includes("invalid email") || lower.includes("unable to validate email")) {
    return {
      message: "That does not look like an email address.",
      retryAfterSeconds: null,
      isRateLimit: false,
    };
  }

  // Unrecognised. Keep GoTrue's own words rather than inventing a friendlier
  // sentence that hides what happened.
  return { message: text, retryAfterSeconds: null, isRateLimit: false };
}

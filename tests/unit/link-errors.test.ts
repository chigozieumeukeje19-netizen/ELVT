import { describe, expect, it } from "vitest";
import { describeLinkFailure } from "@/lib/auth/link-errors";

/**
 * The failure these cover: a magic link request refused by GoTrue's per-address
 * rate limit looked, to the client, exactly like nothing happening. Every case
 * below has to produce a visible sentence, and the ones that are only a wait
 * have to say how long.
 */
describe("describeLinkFailure", () => {
  // Both phrasings GoTrue has used for the per-address limit.
  it.each([
    "For security purposes, you can only request this after 47 seconds.",
    "For security purposes, you can only request this once every 60 seconds",
  ])("reads the wait out of %s", (raw) => {
    const failure = describeLinkFailure(raw);
    expect(failure.isRateLimit).toBe(true);
    expect(failure.retryAfterSeconds).toBeGreaterThan(0);
    expect(failure.message).toContain(String(failure.retryAfterSeconds));
  });

  it("still says something when the limit names no number", () => {
    const failure = describeLinkFailure(
      "For security purposes, you can only request this again later",
    );
    expect(failure.isRateLimit).toBe(true);
    expect(failure.retryAfterSeconds).toBeNull();
    expect(failure.message.length).toBeGreaterThan(0);
    // No countdown promised when there is no number to count.
    expect(failure.message).not.toMatch(/\d+ seconds/);
  });

  it("treats the hourly send limit as a wait with no countdown", () => {
    const failure = describeLinkFailure("email rate limit exceeded");
    expect(failure.isRateLimit).toBe(true);
    expect(failure.retryAfterSeconds).toBeNull();
    expect(failure.message).toContain("hour");
  });

  it("does not call a bad redirect host a rate limit", () => {
    // Waiting never fixes this one, so offering a countdown would be a lie.
    const failure = describeLinkFailure("Invalid redirect: url not allowed");
    expect(failure.isRateLimit).toBe(false);
    expect(failure.retryAfterSeconds).toBeNull();
  });

  it("keeps GoTrue's own words for anything it does not recognise", () => {
    const raw = "Database error finding users";
    expect(describeLinkFailure(raw).message).toBe(raw);
  });

  it("never returns an empty message", () => {
    for (const raw of [
      "For security purposes, you can only request this after 9 seconds.",
      "email rate limit exceeded",
      "over_email_send_rate_limit",
      "Invalid redirect: url not allowed",
      "Unable to validate email address: invalid format",
      "something nobody has seen yet",
    ]) {
      expect(describeLinkFailure(raw).message.trim()).not.toBe("");
    }
  });
});

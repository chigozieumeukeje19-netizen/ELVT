import { expect, test } from "@playwright/test";
import { UNFLAGGED_URL } from "../../playwright.config";

/**
 * The preview gate, tested against a production build with the flag unset.
 *
 * This is the shape of every deployed environment, so a pass here is the thing
 * standing between development instrumentation and a live site. It runs against
 * its own server rather than the flagged one the visual pass uses.
 */

const PREVIEW_SCREENS = [
  "roster",
  "roster-stress",
  "roster-dense",
  "roster-empty",
  "queue",
  "queue-empty",
];

test.describe("a production build with no preview flag", () => {
  test("serves the real app", async ({ request }) => {
    const res = await request.get(`${UNFLAGGED_URL}/login`);
    expect(res.status()).toBe(200);
  });

  for (const screen of PREVIEW_SCREENS) {
    test(`returns 404 for /dev/preview/${screen}`, async ({ request }) => {
      const res = await request.get(`${UNFLAGGED_URL}/dev/preview/${screen}`);
      expect(res.status()).toBe(404);
    });
  }

  test("returns 404 for an unknown preview screen", async ({ request }) => {
    const res = await request.get(`${UNFLAGGED_URL}/dev/preview/anything`);
    expect(res.status()).toBe(404);
  });
});

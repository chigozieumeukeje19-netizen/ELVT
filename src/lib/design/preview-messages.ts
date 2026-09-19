import type { ThreadRow } from "@/components/messages/ThreadView";
import { countTouchpoints } from "@/lib/messages/touchpoints";

/**
 * Fixtures for the inbox.
 *
 * The counts come from the real counter so the bands on screen are the ones the
 * code produces. The spread is deliberate: one client heard from today, one a
 * week ago, and one never, because the ordering exists for the third and a
 * fixture where everyone is fine would not show it working.
 */

const TODAY = "2026-09-24";

function count(dates: string[]) {
  return countTouchpoints(
    dates.map((date) => ({ kind: "message" as const, at: `${date}T10:00:00Z` })),
    TODAY,
  );
}

export const PREVIEW_THREADS: ThreadRow[] = [
  {
    id: "t1", clientId: "c1", slug: "theo", name: "Theo Vance",
    lastBody: "Long run went well, 12 at 8:40 and the calf was quiet the whole way.",
    lastAt: "2026-09-23", lastFrom: "client", unread: true, scheduled: 0,
    touchpoints: count(["2026-09-22", "2026-09-24"]),
  },
  {
    id: "t2", clientId: "c2", slug: "ekaterina", name: "Ekaterina Vasilyeva-Whitcombe",
    lastBody: "Calories go to 2,450 and the step goal drops to 6,500 until you are home.",
    lastAt: "2026-09-22", lastFrom: "coach", unread: false, scheduled: 1,
    touchpoints: count(["2026-09-22"]),
  },
  {
    id: "t3", clientId: "c3", slug: "janessa", name: "Janessa Okonkwo-Bright",
    lastBody: "Skip tomorrow's hinge and do the mobility instead.",
    lastAt: "2026-09-17", lastFrom: "coach", unread: false, scheduled: 0,
    touchpoints: count(["2026-09-17"]),
  },
  {
    id: "t4", clientId: "c4", slug: "karar", name: "Karar Al-Mansouri",
    lastBody: "Nothing sent yet", lastAt: "", lastFrom: "coach", unread: false, scheduled: 0,
    touchpoints: count([]),
  },
];

/** What the portal knows about one client, for filling a quick reply. */
export const PREVIEW_COMPOSER_VALUES: Record<string, string | number> = {
  steps_a: 5200,
  steps_b: 4800,
  step_goal: 7400,
  done: 2,
  planned: 4,
  session: "Lower body",
  day: "Saturday",
  average: 189.8,
  change: "down 0.3",
  new_calories: 2450,
  score: 71,
  training_done: 3,
  training_planned: 3,
  next_week: 6,
  area: "the back",
  level: 6,
  threshold: 4,
  movement: "hinge",
  last_date: "2026-09-16",
  days: 4,
  minutes: 3,
  mileage: 18,
  last_session: "Thursday",
};

/** Missing the step figures, so the composer has to say which. */
export const PREVIEW_COMPOSER_THIN: Record<string, string | number> = {
  done: 2,
  planned: 4,
  session: "Lower body",
  day: "Saturday",
};

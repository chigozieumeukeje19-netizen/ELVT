import type { QueueRow } from "@/components/queue/QueueLanes";

/**
 * Fixtures for the queue lane screens.
 *
 * One item in each lane so all three render with content, plus an empty version
 * so the "nothing trended" copy is checked rather than assumed. The suggested
 * messages are real ones: two to five lines, one question, real numbers, which
 * is what the voice rules ask for and what a coach would actually send.
 */

export const PREVIEW_QUEUE_ROWS: QueueRow[] = [
  {
    id: "q1",
    lane: "same_day",
    client: "Janessa Okonkwo-Bright",
    slug: "janessa",
    title: "Back discomfort reported at 6",
    detail: "Above the 4 they agreed is worth a message the same day.",
    kind: "trigger",
    severity: 5,
    suggestedMessage:
      "You put your back at 6 today, which is the highest it has been.\nSkip tomorrow's hinge and do the mobility instead.\nWhat were you doing when it went?",
  },
  {
    id: "q2",
    lane: "same_day",
    client: "Karar Al-Mansouri",
    slug: "karar",
    title: "Karar Al-Mansouri has not logged anything for 4 days",
    detail: "Last logged 2026-09-16",
    kind: "retention_risk",
    severity: 4,
    suggestedMessage: "Quiet since Wednesday. Everything alright?",
  },
  {
    id: "q3",
    lane: "trend",
    client: "Ekaterina Vasilyeva-Whitcombe",
    slug: "ekaterina",
    title: "Steps has been under 7000 for two weeks",
    detail: "5600 then 5200.",
    kind: "trigger",
    severity: 3,
    suggestedMessage:
      "Steps were 5,600 then 5,200 against a 7,400 normal.\nThat is two weeks, so it is worth changing rather than waiting.\nWhat does a 20 minute walk look like on a Tuesday?",
  },
  {
    id: "q4",
    lane: "trend",
    client: "Theo Vance",
    slug: "theo",
    title: "Theo Vance ran 31 percent above the previous three weeks",
    detail: "Against 22.4 over the previous three weeks",
    kind: "mileage_spike",
    severity: 3,
    suggestedMessage: null,
  },
  {
    id: "q5",
    lane: "request",
    client: "Andi Lehmann",
    slug: "andi",
    title: "They asked you something",
    detail: "Can I move the long run to Saturday? Sunday is not working with the kids.",
    kind: "checkin_submitted",
    severity: 3,
    suggestedMessage: null,
  },
];

export const PREVIEW_QUEUE_ONE_LANE: QueueRow[] = PREVIEW_QUEUE_ROWS.filter(
  (row) => row.lane === "request",
);

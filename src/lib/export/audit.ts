/**
 * The audits, run against the generated file rather than against the source.
 *
 * Every rule here came from a v1 app going wrong, and each one is checked in
 * the artifact a client actually receives. Auditing the generator instead would
 * pass on the day someone bypasses it.
 *
 * Four audits, the same four the spec names, plus the legacy state case that
 * broke a real client mid program.
 */

export type Finding = { audit: string; rule: string; detail: string };

const AUDITS = {
  scroll: "render never scrolls the page",
  legacy: "older saved state still opens",
  resilience: "one broken card does not take the page",
  completeness: "every card and every non negotiable is present",
} as const;

/**
 * Comments stripped before anything is scanned.
 *
 * The first version of this grepped the whole document, so the comment in the
 * runtime saying "no scrollIntoView anywhere" was itself reported as a call to
 * scrollIntoView. An audit that cannot tell a rule from a violation of it is an
 * audit nobody keeps.
 */
function codeOnly(html: string): string {
  return html
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");
}

export function auditExport(html: string): Finding[] {
  const code = codeOnly(html);
  const findings: Finding[] = [];
  const add = (audit: keyof typeof AUDITS, rule: string, detail: string) =>
    findings.push({ audit: AUDITS[audit], rule, detail });

  // --- 1. render() never scrolls ------------------------------------------
  if (/scrollIntoView/.test(code)) {
    add("scroll", "no scrollIntoView", "The file calls scrollIntoView somewhere.");
  }

  // The scroll position has to be read before the DOM is replaced and restored
  // after. Replacing innerHTML resets it, and a client one tap into a session
  // whose screen jumps to the top stops logging sets.
  const render = code.match(/function render\(\)\s*\{[\s\S]*?\n\}/);
  if (!render) {
    add("scroll", "render exists", "No render function was found in the file.");
  } else {
    const body = render[0];
    const capturesBefore = /window\.scrollX[\s\S]*?innerHTML/.test(body);
    const restoresAfter = /innerHTML[\s\S]*?window\.scrollTo/.test(body);
    if (!capturesBefore) {
      add("scroll", "captures scroll before replacing the DOM", "render replaces innerHTML without reading the scroll position first.");
    }
    if (!restoresAfter) {
      add("scroll", "restores scroll after replacing the DOM", "render replaces innerHTML and never restores the scroll position.");
    }
  }

  // --- 2. Legacy saved state ----------------------------------------------
  const load = code.match(/function load\(\)\s*\{[\s\S]*?\n\}/);
  if (!load) {
    add("legacy", "load exists", "No load function was found in the file.");
  } else {
    const body = load[0];
    // Defaults first, then the saved state over them. The other way round, a
    // client mid program whose saved state predates a new key gets an object
    // missing it, and the app breaks for exactly the people using it longest.
    if (!/Object\.assign\(\s*defaults\s*,\s*saved\s*\)/.test(body)) {
      add("legacy", "defaults first, saved state over them", "load does not Object.assign the saved state over a defaults object.");
    }
    if (/JSON\.parse\(localStorage/.test(body) && !/try\s*\{/.test(body)) {
      add("legacy", "a corrupt store does not throw", "load parses localStorage without a try block.");
    }
  }

  // --- 3. One broken card does not take the page --------------------------
  if (render) {
    const body = render[0];
    const tries = (body.match(/try\s*\{/g) ?? []).length;
    if (tries < 1) {
      add("resilience", "each card in its own try", "render calls the cards with no try block at all.");
    }
    if (!/catch\s*\(/.test(body)) {
      add("resilience", "a thrown card is caught", "render has no catch.");
    }
  }

  // --- 4. Completeness ----------------------------------------------------
  const ORDER = [
    "goal", "weeks", "days", "profile", "training",
    "nutrition", "trackers", "monday", "past", "reference",
  ];

  for (const card of ORDER) {
    if (!html.includes(`data-card="${card}"`)) {
      add("completeness", `the ${card} card exists`, `No card is marked data-card="${card}".`);
    }
  }

  // The order is read from the array render() iterates, not from where the card
  // functions happen to be defined. The first version checked the latter, which
  // meant reordering the array, the thing that actually changes what a client
  // sees, was invisible to the audit.
  const listed = code.match(/var cards = \[([\s\S]*?)\];/);
  if (!listed) {
    add("completeness", "the card order is declared", "render does not list its cards in an array.");
  } else {
    const called = [...listed[1].matchAll(/\["([a-z]+)"/g)].map((match) => match[1]);
    if (called.join(",") !== ORDER.join(",")) {
      add(
        "completeness",
        "the cards are in the fixed order",
        `render calls them as ${called.join(", ")}.`,
      );
    }
  }

  // No notes fields anywhere. Standing ELVT rule: the apps are pure
  // accountability and all coaching data comes from check-ins.
  if (/<textarea/i.test(html)) {
    add("completeness", "no notes fields", "The file contains a textarea.");
  }
  if (/placeholder="[^"]*note/i.test(html)) {
    add("completeness", "no notes fields", "An input is labelled as notes.");
  }

  // Dates reflect the day being viewed, never today.
  if (/viewedDate/.test(code)) {
    const monday = code.match(/function cardMonday\(\)\s*\{[\s\S]*?\n\}/);
    if (monday && !/weekdayOf\(state\.viewedDate\)/.test(monday[0])) {
      add(
        "completeness",
        "Monday cards follow the viewed day",
        "cardMonday does not test the viewed date's weekday.",
      );
    }
  } else {
    add("completeness", "a viewed date exists", "Nothing in the file tracks which day is being viewed.");
  }

  // Week switching archives before it loads.
  const switcher = code.match(/function switchWeek\([\s\S]*?\n\}/);
  if (!switcher) {
    add("completeness", "week switching exists", "No switchWeek function was found.");
  } else if (!/state\.archive\[/.test(switcher[0])) {
    add(
      "completeness",
      "week switching is non destructive",
      "switchWeek does not archive the week being left.",
    );
  }

  // Offline queue.
  if (!/navigator\.onLine/.test(code)) {
    add("completeness", "queues when offline", "Nothing checks whether the device is online.");
  }
  if (!/addEventListener\("online"/.test(code)) {
    add("completeness", "drains when it comes back", "Nothing listens for the connection returning.");
  }

  // The title names the client.
  if (!/<title>[^<]+<\/title>/.test(html)) {
    add("completeness", "the page is titled", "The document has no title.");
  }

  return findings;
}

/** Whether a generated file may be handed to a client. */
export function passesAudits(html: string): boolean {
  return auditExport(html).length === 0;
}

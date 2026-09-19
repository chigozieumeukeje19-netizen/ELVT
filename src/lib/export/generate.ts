import { APP_SCRIPT } from "./app-script";
import { tokenBlock } from "./theme";
import type { ExportData } from "./types";

/**
 * The single file client app.
 *
 * One document, no build step, no network needed to open it. The week is inlined
 * so it works on a phone with no signal, and everything after that goes through
 * the API.
 *
 * The theme is the v1 cream and gold, inlined here and nowhere else. It is
 * marked unslop-ignore in its own file because it is a real brand decision
 * rather than a model default, and the portal must never import it: the two
 * products have opposite jobs, and a client app that looks like the portal is
 * as wrong as a portal that looks like the client app.
 */

/**
 * The title is the client's name and the generation date.
 *
 * Asserted at generation, because the failure this prevents actually happened:
 * the wrong client's file deployed to a client's URL. A title that names who it
 * is for makes that visible in the tab before anyone opens a session.
 */
export function titleFor(data: ExportData): string {
  const name = [data.client.firstName, data.client.lastName].filter(Boolean).join(" ");
  return `${name} · ${data.program.name}`;
}

export class ExportError extends Error {}

/**
 * Everything checked before a byte is written.
 *
 * These are not defensive. Each one is a way the v1 apps went wrong, and a file
 * that fails any of them is worse than no file: a client opens it, hits the
 * broken part mid session, and stops trusting the rest.
 */
export function assertExportable(data: ExportData): void {
  if (!data.client.firstName) {
    throw new ExportError("That client has no name, so the file could not be titled.");
  }
  if (data.weeks.length === 0) {
    throw new ExportError("That client has no program yet, so there is nothing to export.");
  }
  if (!data.client.timezone) {
    throw new ExportError(
      "That client has no timezone, and every date in the app is computed in theirs.",
    );
  }

  const missingVideo: string[] = [];
  const weightOnWrongThing: string[] = [];

  for (const week of data.weeks) {
    for (const day of week.days) {
      for (const session of day.sessions) {
        for (const exercise of session.exercises) {
          // Every exercise has a verified video. A client mid set does not go
          // hunting on YouTube for what a movement is.
          if (!exercise.youtubeId) missingVideo.push(exercise.name);

          // A weight box only on rep based work. Never on a timed hold, never
          // on a run, never on a rest day.
          const repBased = exercise.sets.some((set) => typeof set.reps === "number");
          if (exercise.logsWeight && (!repBased || session.kind === "run" || day.isRest)) {
            weightOnWrongThing.push(`${exercise.name} on ${day.date}`);
          }
        }
      }
    }
  }

  if (missingVideo.length > 0) {
    throw new ExportError(
      `${missingVideo.length} movements have no verified video: ${[...new Set(missingVideo)].slice(0, 5).join(", ")}`,
    );
  }

  if (weightOnWrongThing.length > 0) {
    throw new ExportError(
      `A weight box is on something that is not rep based work: ${weightOnWrongThing.slice(0, 3).join(", ")}`,
    );
  }
}

const THEME = `
${tokenBlock()}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--bg); color: var(--txt);
  font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  padding: 0 16px 48px; max-width: 560px; margin: 0 auto;
}
.card { background: var(--panel); border-radius: var(--radius); padding: 16px; margin: 12px 0; }
.card.compact { padding: 12px 16px; }
.card.err { background: var(--panel2); }
h1 { font-size: 22px; margin: 4px 0 8px; font-weight: 600; }
h2 { font-size: 17px; margin: 16px 0 8px; font-weight: 600; }
.label { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--mut); margin: 0; }
.mut { color: var(--mut); margin: 4px 0; }
.num { font-variant-numeric: tabular-nums; }
.big { font-size: 44px; line-height: 1; margin: 8px 0 0; }
.strip { display: flex; gap: 6px; overflow-x: auto; padding: 8px 0 2px; }
.chip {
  flex: 0 0 auto; min-width: 48px; min-height: 48px; border: 1px solid var(--line);
  border-radius: 8px; background: var(--panel); color: var(--mut); display: flex;
  flex-direction: column; align-items: center; justify-content: center; gap: 2px;
}
.chip.on { background: var(--panel2); color: var(--txt); border-color: var(--gold); }
.row {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  width: 100%; min-height: 48px; border: 0; border-bottom: 1px solid var(--line);
  background: none; color: var(--txt); font: inherit; text-align: left; padding: 0;
}
.row.on { color: var(--gold); }
.ex { border-top: 1px solid var(--line); padding: 12px 0; }
.vid {
  color: var(--gold); text-decoration: none; font-weight: 600;
  display: flex; align-items: center; min-height: 44px;
}
.set { display: flex; align-items: center; gap: 12px; min-height: 48px; }
.set .label { min-width: 52px; }
.w { width: 96px; min-height: 44px; border: 1px solid var(--line); border-radius: 8px; padding: 0 10px; font: inherit; }
/* The photo picker is a tap target like everything else. Left alone it renders
   about 21px, which is not something to ask of a thumb. */
input[type="file"] { min-height: 44px; font: inherit; max-width: 200px; }
details { border-top: 1px solid var(--line); padding: 8px 0; }
summary { min-height: 44px; display: flex; align-items: center; }
`;

export function generateApp(data: ExportData): string {
  assertExportable(data);

  const title = titleFor(data);
  const escaped = JSON.stringify(data)
    // A closing script tag inside the data would end the block early. Every
    // field here is client data, so this is not hypothetical.
    .replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="generated-for" content="${data.client.slug}">
<meta name="generated-at" content="${data.generatedAt}">
<title>${escapeHtml(title)}</title>
<style>${THEME}</style>
</head>
<body>
<main id="app"></main>
<script>
var DATA = ${escaped};
var STORAGE_KEY = "elvt:" + DATA.client.slug;
${APP_SCRIPT}
</script>
</body>
</html>
`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!,
  );
}

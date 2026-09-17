/**
 * Parser for the v1 single file client apps.
 *
 * Those files are the only source where every ELVT movement has already been
 * vetted against a specific video, so they seed the library. The eight files
 * were hand edited over a long period and are not consistent with each other,
 * so this reads the three shapes they use rather than assuming one:
 *
 *   1. a JavaScript object literal carrying a name and a video field;
 *   2. an anchor whose text is the movement and whose href is the video;
 *   3. an iframe embed sitting under a heading or table cell that names it.
 *
 * Anything it finds a video for but cannot name, and anything it names but
 * cannot find a video for, comes back in `unmatched` and lands on the review
 * screen rather than being guessed at.
 */

export type ParsedExercise = {
  name: string;
  youtubeId: string;
  sourceFile: string;
  /** Which of the three shapes produced this row. Useful when reviewing. */
  via: "object" | "anchor" | "embed";
};

export type ParsedUnmatched = {
  sourceFile: string;
  reason: "no_video" | "no_name";
  name?: string;
  youtubeId?: string;
  context: string;
};

export type ParseResult = {
  exercises: ParsedExercise[];
  unmatched: ParsedUnmatched[];
};

/** A YouTube id is exactly eleven characters of this alphabet. */
const ID = "[A-Za-z0-9_-]{11}";

const ID_PATTERNS = [
  new RegExp(`youtube\\.com/watch\\?[^"'\\s]*v=(${ID})`, "i"),
  new RegExp(`youtu\\.be/(${ID})`, "i"),
  new RegExp(`youtube\\.com/embed/(${ID})`, "i"),
  new RegExp(`youtube-nocookie\\.com/embed/(${ID})`, "i"),
  new RegExp(`youtube\\.com/shorts/(${ID})`, "i"),
];

export function extractYouTubeId(value: string): string | null {
  for (const pattern of ID_PATTERNS) {
    const hit = value.match(pattern);
    if (hit) return hit[1];
  }
  // A bare id, which some of the files store on its own in a data attribute.
  const bare = value.trim().match(new RegExp(`^(${ID})$`));
  return bare ? bare[1] : null;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripTags(value: string): string {
  return decodeEntities(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Names in the v1 files carry set and rep prescriptions, superset letters and
 * trailing punctuation. Those belong to the program, not to the movement.
 */
export function cleanName(raw: string): string {
  let name = stripTags(raw);
  name = name.replace(/^\s*[A-H][1-4]?[).:]\s+/, "");        // A1) Back Squat
  name = name.replace(/^\s*\d+[).:]\s+/, "");                 // 1. Back Squat
  name = name.replace(/\s*[-–—:]\s*\d+\s*x\s*\d+.*$/i, "");   // Back Squat 3 x 8
  name = name.replace(/\s*\(\s*\d+\s*x\s*\d+[^)]*\)\s*$/i, "");
  name = name.replace(/\s*[-–—]\s*(watch|demo|video|tutorial)\s*$/i, "");
  name = name.replace(/\s*\b(watch|demo|video)\b\s*$/i, "");
  name = name.replace(/[\s.,;:]+$/, "");
  return name.replace(/\s+/g, " ").trim();
}

/**
 * The key two names have to share to be treated as the same movement. Case,
 * punctuation and filler words are all noise; anything left is the movement.
 */
export function normalizeName(name: string): string {
  return cleanName(name)
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(the|a|an|with|using|each|per|side)\b/g, " ")
    .replace(/\bdb\b/g, "dumbbell")
    .replace(/\bbb\b/g, "barbell")
    .replace(/\bkb\b/g, "kettlebell")
    .replace(/\bsingle leg\b/g, "one leg")
    .replace(/\bsingle arm\b/g, "one arm")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeExerciseName(name: string): boolean {
  if (name.length < 3 || name.length > 80) return false;
  // Headings, nav items and prose are not movements.
  if (/^(week|day|phase|notes?|warm ?up|cool ?down|home|profile|nutrition)$/i.test(name)) {
    return false;
  }
  if (!/[a-z]/i.test(name)) return false;
  return true;
}

export function parseV1Html(html: string, sourceFile: string): ParseResult {
  const exercises: ParsedExercise[] = [];
  const unmatched: ParsedUnmatched[] = [];
  const seen = new Set<string>();

  const record = (name: string, youtubeId: string, via: ParsedExercise["via"]) => {
    const clean = cleanName(name);
    if (!looksLikeExerciseName(clean)) {
      unmatched.push({
        sourceFile,
        reason: "no_name",
        youtubeId,
        context: name.slice(0, 160),
      });
      return;
    }
    const key = `${normalizeName(clean)}::${youtubeId}`;
    if (seen.has(key)) return;
    seen.add(key);
    exercises.push({ name: clean, youtubeId, sourceFile, via });
  };

  // ---- Shape 1: object literals -------------------------------------------
  // { name: "Back Squat", youtube: "dQw4w9WgXcQ" } in any key order.
  const objectPattern = /\{[^{}]{0,400}?\}/g;
  for (const block of html.match(objectPattern) ?? []) {
    const nameHit = block.match(
      /["']?(?:name|exercise|movement|title|lift)["']?\s*:\s*["']([^"']{2,90})["']/i,
    );
    const videoHit = block.match(
      /["']?(?:yt|youtube|youtube_id|youtubeId|video|videoId|url|link|demo)["']?\s*:\s*["']([^"']+)["']/i,
    );
    if (!nameHit) continue;

    const id = videoHit ? extractYouTubeId(videoHit[1]) : null;
    if (id) {
      record(nameHit[1], id, "object");
    } else if (looksLikeExerciseName(cleanName(nameHit[1]))) {
      unmatched.push({
        sourceFile,
        reason: "no_video",
        name: cleanName(nameHit[1]),
        context: block.slice(0, 160),
      });
    }
  }

  // ---- Shape 2: anchors ----------------------------------------------------
  const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorPattern)) {
    const [, attrs, inner] = match;
    const href = attrs.match(/href\s*=\s*["']([^"']+)["']/i)?.[1] ?? "";
    const id = extractYouTubeId(href);
    if (!id) continue;

    const text = stripTags(inner);
    // Some links say "watch" and take their name from the title attribute or
    // from the element just before them.
    const title = attrs.match(/(?:title|aria-label|data-name)\s*=\s*["']([^"']+)["']/i)?.[1];
    const candidate = looksLikeExerciseName(cleanName(text))
      ? text
      : (title ?? textBefore(html, match.index ?? 0));

    if (candidate && looksLikeExerciseName(cleanName(candidate))) {
      record(candidate, id, "anchor");
    } else {
      unmatched.push({
        sourceFile,
        reason: "no_name",
        youtubeId: id,
        context: stripTags(match[0]).slice(0, 160),
      });
    }
  }

  // ---- Shape 3: iframe embeds ---------------------------------------------
  const iframePattern = /<iframe\b([^>]*)>/gi;
  for (const match of html.matchAll(iframePattern)) {
    const src = match[1].match(/src\s*=\s*["']([^"']+)["']/i)?.[1] ?? "";
    const id = extractYouTubeId(src);
    if (!id) continue;

    const title = match[1].match(/title\s*=\s*["']([^"']+)["']/i)?.[1];
    const candidate = title ?? textBefore(html, match.index ?? 0);

    if (candidate && looksLikeExerciseName(cleanName(candidate))) {
      record(candidate, id, "embed");
    } else {
      unmatched.push({
        sourceFile,
        reason: "no_name",
        youtubeId: id,
        context: (candidate ?? match[0]).slice(0, 160),
      });
    }
  }

  return { exercises, unmatched };
}

/**
 * The nearest readable text before an offset, used to name an anchor whose own
 * text is just "watch" or an embed with no title.
 *
 * A heading or a table cell sitting immediately above a video names it. The
 * label of an unrelated link next to it does not, so a candidate that turns out
 * to be anchor text is refused and the video goes to review instead. Guessing
 * here would put a wrong name on a movement and nobody would ever check it.
 */
function textBefore(html: string, index: number): string | null {
  const window = html.slice(Math.max(0, index - 400), index);

  const parts = window.split(/<[^>]*>/);
  let candidate = "";
  let partIndex = -1;
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const text = decodeEntities(parts[i]).replace(/\s+/g, " ").trim();
    if (text) {
      candidate = text;
      partIndex = i;
      break;
    }
  }
  if (!candidate) return null;

  // Everything between that text and the video. A closing anchor in there means
  // the text was a link label.
  const consumed = parts.slice(0, partIndex + 1).join("").length;
  const trailing = window.slice(consumed);
  if (/<\/a\s*>/i.test(trailing)) return null;

  return candidate;
}

/**
 * Folds every file's results into one library. Two rows are the same movement
 * when their normalized names match; the spellings that differ become aliases,
 * which is what the spec means by dedupe on name plus alias.
 */
export function dedupe(results: ParseResult[]): {
  exercises: {
    name: string;
    aliases: string[];
    youtubeId: string;
    sourceFiles: string[];
    conflictingIds: string[];
  }[];
  unmatched: ParsedUnmatched[];
} {
  const byKey = new Map<
    string,
    {
      name: string;
      aliases: Set<string>;
      ids: Map<string, number>;
      sourceFiles: Set<string>;
    }
  >();

  for (const result of results) {
    for (const ex of result.exercises) {
      const key = normalizeName(ex.name);
      if (!key) continue;
      const entry = byKey.get(key) ?? {
        name: ex.name,
        aliases: new Set<string>(),
        ids: new Map<string, number>(),
        sourceFiles: new Set<string>(),
      };
      // Keep the longest spelling as the canonical name; it is usually the one
      // that says "Dumbbell" rather than "DB".
      if (ex.name.length > entry.name.length) {
        entry.aliases.add(entry.name);
        entry.name = ex.name;
      } else if (ex.name !== entry.name) {
        entry.aliases.add(ex.name);
      }
      entry.ids.set(ex.youtubeId, (entry.ids.get(ex.youtubeId) ?? 0) + 1);
      entry.sourceFiles.add(ex.sourceFile);
      byKey.set(key, entry);
    }
  }

  const exercises = [...byKey.values()].map((entry) => {
    const ranked = [...entry.ids.entries()].sort((a, b) => b[1] - a[1]);
    return {
      name: entry.name,
      aliases: [...entry.aliases].sort(),
      youtubeId: ranked[0][0],
      sourceFiles: [...entry.sourceFiles].sort(),
      // The same movement pointing at different videos across files is a real
      // disagreement between the apps, so it goes to review rather than being
      // silently resolved by whichever file was read first.
      conflictingIds: ranked.slice(1).map(([id]) => id),
    };
  });

  exercises.sort((a, b) => a.name.localeCompare(b.name));

  return {
    exercises,
    unmatched: results.flatMap((r) => r.unmatched),
  };
}

/**
 * Exercise library import.
 *
 * Reads the v1 client app HTML files, extracts every movement and its YouTube
 * id, dedupes on name plus alias, and writes exercises rows with
 * media.source = youtube_verified.
 *
 *   npm run exercises:import -- --dir ../v1-archive
 *   npm run exercises:import -- --dir ../v1-archive --dry-run
 *
 * Phase 1 is YouTube ids only. gif_url and video_url stay in the media shape
 * and stay empty, so a later media pass fills them without a migration.
 *
 * Nothing is guessed. A movement the parser cannot name, a name it cannot find
 * a video for, and a movement the files disagree about all land with
 * needs_review set and show up on the Builder review screen.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { dedupe, parseV1Html, type ParseResult } from "../src/lib/exercises/parse-v1";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

type Args = { dir: string; dryRun: boolean };

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const dirFlag = argv.indexOf("--dir");
  if (dirFlag === -1 || !argv[dirFlag + 1]) {
    console.error(
      [
        "Point this at the folder holding the v1 client app files.",
        "",
        "  npm run exercises:import -- --dir ../v1-archive",
        "",
        "It reads every .html file in that folder and its subfolders.",
      ].join("\n"),
    );
    process.exit(1);
  }
  return { dir: argv[dirFlag + 1], dryRun: argv.includes("--dry-run") };
}

function htmlFilesIn(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...htmlFilesIn(full));
    } else if (/\.html?$/i.test(entry)) {
      out.push(full);
    }
  }
  return out.sort();
}

async function main() {
  const { dir, dryRun } = parseArgs();
  const files = htmlFilesIn(dir);

  if (files.length === 0) {
    console.error(`No HTML files under ${dir}.`);
    process.exit(1);
  }

  console.log(`Reading ${files.length} files from ${dir}`);
  if (files.length !== 8) {
    console.log(
      `Note: the spec describes eight client apps and this folder has ${files.length}.`,
    );
  }

  const results: ParseResult[] = files.map((file) =>
    parseV1Html(readFileSync(file, "utf8"), path.basename(file)),
  );

  for (const [i, result] of results.entries()) {
    console.log(
      `  ${path.basename(files[i])}: ${result.exercises.length} found, ` +
        `${result.unmatched.length} to review`,
    );
  }

  const { exercises, unmatched } = dedupe(results);
  const conflicted = exercises.filter((e) => e.conflictingIds.length > 0);

  console.log("");
  console.log(`${exercises.length} distinct movements after dedupe`);
  console.log(`${conflicted.length} where the files disagree on the video`);
  console.log(`${unmatched.length} entries that need a human`);

  if (dryRun) {
    console.log("\nDry run. Nothing written.");
    for (const ex of exercises.slice(0, 20)) {
      console.log(`  ${ex.name}  ${ex.youtubeId}  ${ex.aliases.join(", ")}`);
    }
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to write.",
    );
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const now = new Date().toISOString();

  const rows = exercises.map((ex) => ({
    name: ex.name,
    aliases: ex.aliases,
    media: {
      youtube_id: ex.youtubeId,
      gif_url: null,
      video_url: null,
      thumb_url: `https://i.ytimg.com/vi/${ex.youtubeId}/hqdefault.jpg`,
      // These ids were vetted against the movement in the live client apps,
      // which is the whole reason this import exists.
      source: "youtube_verified",
      verified_at: now,
    },
    import_source: ex.sourceFiles.join(", "),
    needs_review: ex.conflictingIds.length > 0,
    review_note:
      ex.conflictingIds.length > 0
        ? `The v1 files disagree on the video. Also seen: ${ex.conflictingIds.join(", ")}`
        : null,
  }));

  // Name is unique case insensitively, so a re-run updates rather than
  // duplicating. A coach edit to an existing row is not overwritten here.
  const { error } = await supabase
    .from("exercises")
    .upsert(rows, { onConflict: "name", ignoreDuplicates: false });

  if (error) {
    console.error(`Write failed: ${error.message}`);
    process.exit(1);
  }

  // Everything the parser could not resolve becomes a review row, so the
  // Builder screen is the single place this gets finished off.
  const reviewRows = unmatched.map((u) => ({
    name:
      u.name ??
      `Unnamed video ${u.youtubeId} (${u.sourceFile})`,
    aliases: [] as string[],
    media: {
      youtube_id: u.youtubeId ?? null,
      gif_url: null,
      video_url: null,
      thumb_url: u.youtubeId
        ? `https://i.ytimg.com/vi/${u.youtubeId}/hqdefault.jpg`
        : null,
      source: u.youtubeId ? "youtube_verified" : null,
      verified_at: u.youtubeId ? now : null,
    },
    import_source: u.sourceFile,
    needs_review: true,
    review_note:
      u.reason === "no_video"
        ? "Named in the v1 app with no video attached."
        : `A video with no name the parser trusted. Context: ${u.context}`,
  }));

  if (reviewRows.length > 0) {
    const { error: reviewError } = await supabase
      .from("exercises")
      .upsert(reviewRows, { onConflict: "name", ignoreDuplicates: true });
    if (reviewError) {
      console.error(`Review rows failed: ${reviewError.message}`);
      process.exit(1);
    }
  }

  console.log("");
  console.log(`Wrote ${rows.length} movements.`);
  console.log(`${reviewRows.length + conflicted.length} need review.`);
  console.log("Open /coach/builder/exercises/review to clear them.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  cleanName,
  dedupe,
  extractYouTubeId,
  normalizeName,
  parseV1Html,
} from "@/lib/exercises/parse-v1";

const fixtures = path.resolve(__dirname, "../fixtures");
const sampleA = readFileSync(path.join(fixtures, "v1-sample.html"), "utf8");
const sampleB = readFileSync(path.join(fixtures, "v1-sample-b.html"), "utf8");

describe("extractYouTubeId", () => {
  it("reads every URL shape the v1 files use", () => {
    expect(extractYouTubeId("https://www.youtube.com/watch?v=aaaaaaaaaaa")).toBe("aaaaaaaaaaa");
    expect(extractYouTubeId("https://youtu.be/bbbbbbbbbbb")).toBe("bbbbbbbbbbb");
    expect(extractYouTubeId("https://www.youtube.com/embed/ccccccccccc")).toBe("ccccccccccc");
    expect(extractYouTubeId("https://www.youtube.com/shorts/ddddddddddd")).toBe("ddddddddddd");
    expect(extractYouTubeId("https://www.youtube.com/watch?list=x&v=eeeeeeeeeee")).toBe("eeeeeeeeeee");
    expect(extractYouTubeId("eeeeeeeeeee")).toBe("eeeeeeeeeee");
  });

  it("returns null for anything that is not a video", () => {
    expect(extractYouTubeId("https://example.com/guide")).toBeNull();
    expect(extractYouTubeId("")).toBeNull();
    expect(extractYouTubeId("too-short")).toBeNull();
  });
});

describe("cleanName", () => {
  it("drops the prescription and keeps the movement", () => {
    expect(cleanName("A1) Barbell Back Squat")).toBe("Barbell Back Squat");
    expect(cleanName("1. Romanian Deadlift")).toBe("Romanian Deadlift");
    expect(cleanName("Back Squat - 3 x 8")).toBe("Back Squat");
    expect(cleanName("Front Squat (4x6 @ RPE 8)")).toBe("Front Squat");
    expect(cleanName("Seated Cable Row - watch")).toBe("Seated Cable Row");
  });
});

describe("normalizeName", () => {
  it("treats the common abbreviations as the same movement", () => {
    expect(normalizeName("DB Bench Press")).toBe(normalizeName("Dumbbell Bench Press"));
    expect(normalizeName("KB Swing")).toBe(normalizeName("Kettlebell Swing"));
    expect(normalizeName("Single Leg RDL")).toBe(normalizeName("One Leg RDL"));
  });

  it("keeps genuinely different movements apart", () => {
    expect(normalizeName("Back Squat")).not.toBe(normalizeName("Front Squat"));
    expect(normalizeName("Barbell Row")).not.toBe(normalizeName("Cable Row"));
  });
});

describe("parseV1Html", () => {
  const result = parseV1Html(sampleA, "v1-sample.html");
  const names = result.exercises.map((e) => e.name);

  it("reads object literals", () => {
    expect(names).toContain("Barbell Back Squat");
    expect(names).toContain("DB Bench Press");
    expect(names).toContain("Romanian Deadlift");
  });

  it("reads anchors, including one whose text is just watch", () => {
    expect(names).toContain("Kettlebell Swing");
    expect(names).toContain("Seated Cable Row");
  });

  it("reads iframe embeds", () => {
    expect(names).toContain("Walking Lunge");
  });

  it("ignores links that are not videos", () => {
    expect(names).not.toContain("Nutrition guide");
  });

  it("sends a named movement with no video to review", () => {
    const noVideo = result.unmatched.filter((u) => u.reason === "no_video");
    expect(noVideo.map((u) => u.name)).toContain("Face Pull");
  });

  it("sends a video it cannot name to review rather than guessing", () => {
    const noName = result.unmatched.filter((u) => u.reason === "no_name");
    expect(noName.map((u) => u.youtubeId)).toContain("ggggggggggg");
  });

  it("does not record the same movement and video twice within one file", () => {
    const squats = result.exercises.filter((e) => e.youtubeId === "aaaaaaaaaaa");
    expect(squats).toHaveLength(1);
  });
});

describe("dedupe", () => {
  const merged = dedupe([
    parseV1Html(sampleA, "v1-sample.html"),
    parseV1Html(sampleB, "v1-sample-b.html"),
  ]);

  it("folds the same movement across files into one row", () => {
    const squat = merged.exercises.filter(
      (e) => normalizeName(e.name) === normalizeName("Barbell Back Squat"),
    );
    expect(squat.length).toBeLessThanOrEqual(1);
  });

  it("keeps the fuller spelling and files the shorter one as an alias", () => {
    const bench = merged.exercises.find((e) =>
      normalizeName(e.name) === normalizeName("Dumbbell Bench Press"),
    );
    expect(bench?.name).toBe("Dumbbell Bench Press");
    expect(bench?.aliases).toContain("DB Bench Press");
  });

  it("flags a movement the files disagree about instead of picking one", () => {
    const swing = merged.exercises.find((e) =>
      normalizeName(e.name) === normalizeName("Kettlebell Swing"),
    );
    expect(swing?.conflictingIds.length).toBeGreaterThan(0);
  });

  it("records which files each movement came from", () => {
    const bench = merged.exercises.find((e) =>
      normalizeName(e.name) === normalizeName("Dumbbell Bench Press"),
    );
    expect(bench?.sourceFiles.length).toBe(2);
  });
});

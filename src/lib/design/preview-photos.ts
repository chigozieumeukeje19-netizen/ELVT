import { byWeek, comparisonsFor, type Photo } from "@/lib/photos/gallery";

/**
 * Fixtures for the photo screens.
 *
 * No images. The screens are checked for layout and for what they say about
 * missing photos, and putting pictures of people into a repository to test a
 * grid would be the wrong trade even with consent. Every slot therefore renders
 * its "not taken" or "link expired" state, which is the state worth checking
 * anyway: a full grid of photographs is the easy case.
 */

const PHOTOS: Photo[] = [
  { id: "1f", weekNumber: 1, takenOn: "2026-09-21", angle: "front", storagePath: "c/week-1/front" },
  { id: "1s", weekNumber: 1, takenOn: "2026-09-21", angle: "side", storagePath: "c/week-1/side" },
  { id: "1b", weekNumber: 1, takenOn: "2026-09-21", angle: "back", storagePath: "c/week-1/back" },
  // Week 4 is partial, which is the case worth a message.
  { id: "4f", weekNumber: 4, takenOn: "2026-10-12", angle: "front", storagePath: "c/week-4/front" },
  { id: "4s", weekNumber: 4, takenOn: "2026-10-12", angle: "side", storagePath: "c/week-4/side" },
  { id: "8f", weekNumber: 8, takenOn: "2026-11-09", angle: "front", storagePath: "c/week-8/front" },
  { id: "8s", weekNumber: 8, takenOn: "2026-11-09", angle: "side", storagePath: "c/week-8/side" },
  { id: "8b", weekNumber: 8, takenOn: "2026-11-09", angle: "back", storagePath: "c/week-8/back" },
];

export const PREVIEW_PHOTO_WEEKS = byWeek(PHOTOS);
export const PREVIEW_PHOTO_COMPARISONS = comparisonsFor(PREVIEW_PHOTO_WEEKS, 12);
export const PREVIEW_PHOTO_ONE_WEEK = byWeek(PHOTOS.filter((photo) => photo.weekNumber === 1));

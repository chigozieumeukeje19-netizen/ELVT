import { NextResponse } from "next/server";
import { apiError, handler } from "@/lib/api/context";

export const dynamic = "force-dynamic";

const ANGLES = ["front", "side", "back"];
const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

/**
 * POST /api/v1/photos
 *
 * Multipart, one file per angle. Written to a bucket path keyed by the client
 * id from the token rather than by anything in the body: a path a caller can
 * name is a path a caller can point at someone else's folder.
 *
 * Signed URLs with a short expiry are minted on read, never stored, so a link
 * that leaks stops working.
 */
export const POST = handler(async ({ clientId, db }, request) => {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return apiError(400, "Send the photos as a multipart form.");
  }

  const week = String(form.get("week") ?? "");
  if (!/^\d+$/.test(week)) return apiError(400, "Which week are these for?");

  const written: { angle: string; path: string }[] = [];

  for (const angle of ANGLES) {
    const file = form.get(angle);
    if (!(file instanceof File)) continue;

    if (file.size > MAX_BYTES) {
      return apiError(413, `That ${angle} photo is over ${MAX_BYTES / 1024 / 1024}MB.`);
    }
    if (!TYPES.includes(file.type)) {
      return apiError(415, "Photos have to be an image.");
    }

    // The client id comes from the verified token, never from the body.
    const path = `${clientId}/week-${week}/${angle}-${Date.now()}`;

    const { error } = await db.storage
      .from("client-photos")
      .upload(path, file, { contentType: file.type, upsert: true });

    if (error) return apiError(400, "That photo could not be saved.");
    written.push({ angle, path });
  }

  if (written.length === 0) return apiError(400, "No photos were attached.");
  return NextResponse.json({ week: Number(week), photos: written });
});

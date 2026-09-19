import { notFound, redirect } from "next/navigation";
import { ScreenHeader } from "@/components/ScreenHeader";
import { PhotoCompare } from "@/components/photos/PhotoCompare";
import { PhotoGrid } from "@/components/photos/PhotoGrid";
import { currentProfile, isStaff } from "@/lib/auth";
import {
  BUCKET,
  byWeek,
  comparisonsFor,
  SIGNED_URL_SECONDS,
  type Angle,
  type Photo,
} from "@/lib/photos/gallery";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * A client's photos.
 *
 * Every link on this page is signed and expires in five minutes. Nothing is
 * stored: a link to a photograph of someone's body that keeps working after it
 * leaks is the thing to avoid, and a short expiry is how.
 *
 * The rows are read as the coach, so RLS decides which client's photos this is.
 * Only the signing uses the service role, and only for paths that came back
 * from that read.
 */
export default async function PhotosPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ view?: string; compare?: string }>;
}) {
  const profile = await currentProfile();
  if (!profile) redirect("/login");
  if (!isStaff(profile.role)) redirect("/client/today");

  const { slug } = await params;
  const { view, compare } = await searchParams;
  const supabase = await supabaseServer();

  const { data: client } = await supabase
    .from("clients")
    .select("id, first_name, last_name, program_length_weeks")
    .eq("slug", slug)
    .maybeSingle();
  if (!client) notFound();

  const name = [client.first_name, client.last_name].filter(Boolean).join(" ");

  const { data: rows } = await supabase
    .from("progress_photos")
    .select("id, week_number, taken_on, angle, storage_path")
    .eq("client_id", client.id)
    .order("week_number")
    .order("taken_on");

  const photos: Photo[] = (rows ?? []).map((row) => ({
    id: row.id,
    weekNumber: row.week_number ?? 0,
    takenOn: row.taken_on,
    angle: row.angle as Angle,
    storagePath: row.storage_path,
  }));

  const weeks = byWeek(photos);
  const comparisons = comparisonsFor(weeks, client.program_length_weeks ?? 12);
  const comparing = view === "compare";
  const selected = compare ?? comparisons[0]?.key ?? null;
  const chosen = comparisons.find((entry) => entry.key === selected) ?? comparisons[0] ?? null;

  // Only the photos on screen are signed. Minting a link for every photo a
  // client has ever taken puts links in a page nobody asked for.
  const needed = comparing && chosen
    ? photos.filter((photo) => photo.weekNumber === chosen.from || photo.weekNumber === chosen.to)
    : photos;

  const urls: Record<string, string> = {};
  if (needed.length > 0) {
    const admin = supabaseAdmin();
    const { data: signed } = await admin.storage
      .from(BUCKET)
      .createSignedUrls(
        needed.map((photo) => photo.storagePath),
        SIGNED_URL_SECONDS,
      );

    for (const [index, entry] of (signed ?? []).entries()) {
      // A link that could not be minted is left out rather than faked, and the
      // grid says so where the image would have been.
      if (entry?.signedUrl) urls[needed[index].id] = entry.signedUrl;
    }
  }

  const base = `/coach/clients/${slug}/photos`;

  return (
    <main className="px-5 py-4">
      <ScreenHeader
        label="Photos"
        title={name}
        note={
          weeks.length === 0
            ? "Nothing yet"
            : `${weeks.length} ${weeks.length === 1 ? "week" : "weeks"}, links expire in five minutes`
        }
        actions={
          <a
            className="elvt-button-secondary"
            href={comparing ? base : `${base}?view=compare`}
          >
            {comparing ? "All weeks" : "Compare"}
          </a>
        }
      />

      {comparing ? (
        <PhotoCompare
          from={weeks.find((week) => week.weekNumber === chosen?.from) ?? null}
          to={weeks.find((week) => week.weekNumber === chosen?.to) ?? null}
          urls={urls}
          comparisons={comparisons}
          selected={selected}
          hrefFor={(key) => `${base}?view=compare&compare=${key}`}
        />
      ) : (
        <PhotoGrid weeks={weeks} urls={urls} />
      )}
    </main>
  );
}

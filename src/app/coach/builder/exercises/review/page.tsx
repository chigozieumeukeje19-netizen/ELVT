import { redirect } from "next/navigation";
import { BuilderNav } from "@/components/BuilderNav";
import { currentProfile, isStaff } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { discardExercise, resolveExercise } from "./actions";

export const dynamic = "force-dynamic";

type ExerciseRow = {
  id: string;
  name: string;
  aliases: string[] | null;
  review_note: string | null;
  import_source: string | null;
  media: { youtube_id?: string | null; thumb_url?: string | null } | null;
};

/**
 * The unmatched review screen.
 *
 * The import never guesses. Anything it could not name, could not find a video
 * for, or found two different videos for lands here with the context it had, so
 * the whole library gets resolved by hand once and then stays resolved.
 */
export default async function ExerciseReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const profile = await currentProfile();
  if (!profile) redirect("/login");
  if (!isStaff(profile.role)) redirect("/client/today");

  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("exercises")
    .select("id, name, aliases, review_note, import_source, media")
    .eq("needs_review", true)
    .order("name");

  const rows = (data ?? []) as ExerciseRow[];

  return (
    <main className="max-w-[760px] px-5 py-4">
      <BuilderNav current="/coach/builder/exercises/review" />
      <p className="elvt-label">Builder</p>
      <h1 className="mt-1 text-section">Exercise review</h1>
      {error ? (
        <p role="alert" className="mt-4 text-flag">
          {error}
        </p>
      ) : null}

      <p className="mt-2 max-w-[60ch] text-txt-mute">
        {rows.length === 0
          ? "Every imported movement has a confirmed name and video. Run the import again after adding a client app file and anything new lands here."
          : `${rows.length} imported movements need a decision. Confirm the name and the video, or discard the row.`}
      </p>

      <ul className="mt-5" data-testid="review-list">
        {rows.map((row) => (
          <li key={row.id} className="border-line py-4 [border-top-width:1px]">
            <div className="flex gap-4">
              {row.media?.thumb_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={row.media.thumb_url}
                  alt=""
                  width={160}
                  height={90}
                  className="h-[90px] w-[160px] rounded-none object-cover"
                />
              ) : (
                <div className="flex h-[90px] w-[160px] items-center justify-center bg-panel-2">
                  <span className="elvt-label">No video</span>
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{row.name}</p>
                {row.review_note ? (
                  <p className="mt-1 max-w-[60ch] text-txt-mute">{row.review_note}</p>
                ) : null}
                {row.import_source ? (
                  <p className="elvt-label mt-1">From {row.import_source}</p>
                ) : null}
              </div>
            </div>

            <form action={resolveExercise} className="mt-3 grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="id" value={row.id} />

              <label className="block">
                <span className="elvt-label">Name</span>
                <input
                  className="elvt-input mt-1"
                  name="name"
                  defaultValue={
                    row.name.startsWith("Unnamed video ") ? "" : row.name
                  }
                  required
                  minLength={2}
                />
              </label>

              <label className="block">
                <span className="elvt-label">YouTube id</span>
                <input
                  className="elvt-input mt-1"
                  name="youtubeId"
                  defaultValue={row.media?.youtube_id ?? ""}
                  pattern="[A-Za-z0-9_\-]{11}"
                  placeholder="Eleven characters"
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="elvt-label">
                  Other spellings, separated by commas
                </span>
                <input
                  className="elvt-input mt-1"
                  name="aliases"
                  defaultValue={(row.aliases ?? []).join(", ")}
                />
              </label>

              <div className="flex gap-2 sm:col-span-2">
                <button className="elvt-button" type="submit">
                  Confirm
                </button>
                <button
                  className="elvt-button-secondary"
                  type="submit"
                  formAction={discardExercise}
                >
                  Discard
                </button>
              </div>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}

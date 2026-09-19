import { ANGLES, type WeekSet } from "@/lib/photos/gallery";

/**
 * The gallery, by week.
 *
 * A missing angle shows as a marked gap rather than being dropped, because a
 * client who took the front and forgot the back is a different fact from a
 * client who took nothing, and only the first is worth a message.
 *
 * Signed URLs arrive already minted and expire in five minutes. Nothing here
 * stores one.
 */
export function PhotoGrid({
  weeks,
  urls,
}: {
  weeks: WeekSet[];
  /** Photo id to signed URL. Missing means the link could not be minted. */
  urls: Record<string, string>;
}) {
  if (weeks.length === 0) {
    return (
      <p className="text-txt-secondary" data-testid="photos-empty">
        No photos yet. They are asked for on Monday morning, front, side and
        back, so the first set lands within a week of the program starting.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6" data-testid="photo-grid">
      {weeks.map((week) => (
        <section key={week.weekNumber} data-testid="photo-week">
          <div className="flex items-baseline justify-between gap-3">
            <p className="elvt-label">Week {week.weekNumber}</p>
            <span className="elvt-num text-txt-tertiary">
              {week.takenOn}
              {week.taken < 3 ? (
                <span className="elvt-label ml-3 text-watch" data-testid="partial-week">
                  {week.taken} of 3
                </span>
              ) : null}
            </span>
          </div>

          <div className="mt-2 grid grid-cols-3 gap-2">
            {ANGLES.map((angle) => {
              const photo = week.photos[angle];
              const url = photo ? urls[photo.id] : undefined;

              return (
                <figure key={angle} className="m-0" data-testid="photo-slot" data-angle={angle}>
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url}
                      alt={`${angle} on ${photo!.takenOn}`}
                      className="aspect-[3/4] w-full bg-raised object-cover"
                    />
                  ) : (
                    <div
                      className="flex aspect-[3/4] w-full items-center justify-center bg-raised"
                      data-testid="photo-missing"
                    >
                      <span className="elvt-label text-txt-tertiary">
                        {photo ? "Link expired" : "Not taken"}
                      </span>
                    </div>
                  )}
                  <figcaption className="elvt-label mt-1 capitalize">{angle}</figcaption>
                </figure>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

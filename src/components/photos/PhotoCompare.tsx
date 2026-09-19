import { ANGLES, type Comparison, type WeekSet } from "@/lib/photos/gallery";

/**
 * Two weeks side by side, one row per angle.
 *
 * By angle rather than by week, because that is the comparison a person
 * actually makes: front against front. A grid of six photos in week order makes
 * the reader do the pairing themselves, and they will do it wrong.
 *
 * The two images are the same size and the same aspect, always. A comparison
 * where one side is bigger is a comparison that has already made its point.
 */
export function PhotoCompare({
  from,
  to,
  urls,
  comparisons,
  selected,
  hrefFor,
}: {
  from: WeekSet | null;
  to: WeekSet | null;
  urls: Record<string, string>;
  comparisons: Comparison[];
  selected: string | null;
  hrefFor: (key: string) => string;
}) {
  if (comparisons.length === 0) {
    return (
      <p className="text-txt-mute" data-testid="compare-unavailable">
        Two sets of photos make a comparison. There is one so far, so this fills
        in after the next Monday they take them.
      </p>
    );
  }

  return (
    <div data-testid="photo-compare">
      <nav aria-label="Comparisons" className="flex flex-wrap gap-2">
        {comparisons.map((comparison) => (
          <a
            key={comparison.key}
            href={hrefFor(comparison.key)}
            aria-current={comparison.key === selected ? "page" : undefined}
            className={`elvt-chip ${comparison.key === selected ? "bg-panel-2 text-txt" : "text-txt-mute"}`}
          >
            {comparison.label}
          </a>
        ))}
      </nav>

      {from && to ? (
        <div className="mt-4 flex flex-col gap-4">
          {ANGLES.map((angle) => {
            const before = from.photos[angle];
            const after = to.photos[angle];
            if (!before && !after) return null;

            return (
              <section key={angle} data-testid="compare-row" data-angle={angle}>
                <p className="elvt-label capitalize">{angle}</p>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {[
                    { week: from.weekNumber, photo: before },
                    { week: to.weekNumber, photo: after },
                  ].map((side) => (
                    <figure key={side.week} className="m-0" data-testid="compare-side">
                      {side.photo && urls[side.photo.id] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={urls[side.photo.id]}
                          alt={`${angle} in week ${side.week}`}
                          className="aspect-[3/4] w-full bg-panel-2 object-cover"
                        />
                      ) : (
                        <div className="flex aspect-[3/4] w-full items-center justify-center bg-panel-2">
                          <span className="elvt-label text-txt-dim">Not taken</span>
                        </div>
                      )}
                      <figcaption className="elvt-label mt-1">Week {side.week}</figcaption>
                    </figure>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

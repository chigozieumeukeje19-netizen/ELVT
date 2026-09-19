import Link from "next/link";
import { humanize } from "@/components/Field";

/**
 * The exercise library. A dense table like the roster, 44px rows, no card.
 *
 * The Limits column shows which flags rule a movement out. It is the only
 * column that carries a signal color, because a contraindication is the one
 * thing on this screen that changes what a client is allowed to be given.
 */

export type ExerciseRow = {
  id: string;
  name: string;
  aliases: string[];
  pattern: string | null;
  primary_muscle: string | null;
  equipment: string[];
  level: string | null;
  needs_review: boolean;
  contraindications: string[];
  alternatives: number;
  youtube_id: string | null;
};

const NO_DATA = "·";

export function ExerciseTable({ rows }: { rows: ExerciseRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="max-w-[68ch] px-3 py-5 text-txt-secondary">
        The library is empty. Add a movement below, or run the import against
        the v1 client app files to bring the whole vetted set in at once.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="elvt-table" data-testid="exercise-table">
        <thead>
          <tr>
            <th scope="col" className="w-[240px]">Movement</th>
            <th scope="col" className="w-[110px]">Pattern</th>
            <th scope="col" className="w-[120px]">Muscle</th>
            <th scope="col" className="w-[160px]">Equipment</th>
            <th scope="col" className="w-[110px]">Level</th>
            <th scope="col" className="w-[170px]">Limits</th>
            <th scope="col" className="w-[90px]">Swaps</th>
            <th scope="col" className="w-[80px]">Video</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} data-testid="exercise-row">
              <td>
                <Link
                  href={`/coach/builder/exercises/${row.id}`}
                  className="text-txt"
                >
                  {row.name}
                </Link>
                {row.needs_review ? (
                  <span className="elvt-label ml-2 text-txt-secondary">Review</span>
                ) : null}
              </td>
              <td className="text-txt-secondary">
                {row.pattern ? humanize(row.pattern) : NO_DATA}
              </td>
              <td className="text-txt-secondary">
                {row.primary_muscle ? humanize(row.primary_muscle) : NO_DATA}
              </td>
              <td className="text-txt-secondary">
                {row.equipment.length
                  ? row.equipment.map(humanize).join(", ")
                  : NO_DATA}
              </td>
              <td className="text-txt-secondary">
                {row.level ? humanize(row.level) : NO_DATA}
              </td>
              {/*
                Neutral on purpose. A contraindication is a permanent property
                of the movement, not an open flag, and DESIGN.md Part 2 gives
                --flag exactly one meaning. The words carry it instead.
              */}
              <td className={row.contraindications.length ? "text-txt" : "text-txt-tertiary"}>
                {row.contraindications.length
                  ? row.contraindications.map(humanize).join(", ")
                  : NO_DATA}
              </td>
              <td className="elvt-num text-txt-secondary">
                {row.alternatives > 0 ? row.alternatives : NO_DATA}
              </td>
              <td className="text-txt-secondary">
                {row.youtube_id ? "Yes" : NO_DATA}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

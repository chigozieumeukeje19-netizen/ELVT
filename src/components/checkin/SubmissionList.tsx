/**
 * Every submission for a client, newest first.
 *
 * Reviewed or not is the only status that matters here, so it is the only thing
 * colored: an unreviewed weekly older than a couple of days is the thing the
 * coach is looking for on this screen.
 */
export type SubmissionRow = {
  id: string;
  kind: "daily" | "weekly" | "week1";
  forDate: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  /** Their answer to the one question that decides the week. */
  headline: string;
  replies: number;
};

export function SubmissionList({ rows }: { rows: SubmissionRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-txt-mute" data-testid="submissions-empty">
        Nothing submitted yet. Dailies arrive every evening and the weekly lands
        on Sunday, so the first ones show up here within a day of the program
        starting.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="elvt-table min-w-[720px]" data-testid="submission-list">
        <caption className="sr-only">Check-in submissions</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Form</th>
            <th scope="col">What they said</th>
            <th scope="col">Replies</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const waiting = row.submittedAt !== null && row.reviewedAt === null;
            return (
              <tr key={row.id} data-testid="submission-row">
                <th scope="row" className="elvt-num font-normal">
                  {row.forDate}
                </th>
                <td className="text-txt-mute">
                  {row.kind === "week1" ? "Week 1" : row.kind === "weekly" ? "Weekly" : "Daily"}
                </td>
                <td className="max-w-[40ch] truncate">{row.headline}</td>
                <td className="elvt-num text-txt-mute">{row.replies || ""}</td>
                <td className={waiting ? "text-watch" : "text-txt-mute"}>
                  {row.submittedAt === null
                    ? "Not submitted"
                    : waiting
                      ? "Waiting on you"
                      : "Reviewed"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

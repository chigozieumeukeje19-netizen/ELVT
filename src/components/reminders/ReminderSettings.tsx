import { humanize } from "@/components/Field";
import {
  DIGEST_WINDOW_MINUTES,
  lateInWords,
  REMINDER_COPY,
  type ReminderSetting,
} from "@/lib/reminders/plan";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * A client's reminder times.
 *
 * The screen states the digest rule rather than leaving the coach to discover
 * it by setting four things for 07:00 and wondering why one message arrived.
 * Reminders inside an hour of each other are marked, so the grouping is visible
 * while it is being set up rather than only in what the client receives.
 */
export function ReminderSettings({
  settings,
  action,
  clientId,
  readOnly,
}: {
  settings: ReminderSetting[];
  action?: (formData: FormData) => void;
  clientId?: string;
  readOnly?: boolean;
}) {
  const enabled = settings.filter((setting) => setting.enabled);
  const grouped = new Set<string>();

  for (const setting of enabled) {
    const minutes = toMinutes(setting.time);
    const others = enabled.filter(
      (other) =>
        other.kind !== setting.kind &&
        Math.abs(toMinutes(other.time) - minutes) <= DIGEST_WINDOW_MINUTES,
    );
    if (others.length > 0) grouped.add(setting.kind);
  }

  const body = (
    <div className="overflow-x-auto">
      <table className="elvt-table min-w-[620px]" data-testid="reminder-settings">
        <caption className="sr-only">Reminder times</caption>
        <thead>
          <tr>
            <th scope="col">Reminder</th>
            <th scope="col">What it says</th>
            <th scope="col">Time</th>
            <th scope="col">Days</th>
            <th scope="col">Stops after</th>
            <th scope="col">On</th>
          </tr>
        </thead>
        <tbody>
          {settings.map((setting) => (
            <tr key={setting.kind} data-testid="reminder-row">
              <th scope="row" className="font-normal">
                {humanize(setting.kind)}
                {grouped.has(setting.kind) && setting.enabled ? (
                  <span className="elvt-label ml-2 text-txt-tertiary" data-testid="grouped">
                    Sent together
                  </span>
                ) : null}
              </th>
              <td className="max-w-[28ch] truncate text-txt-secondary">
                {REMINDER_COPY[setting.kind]}
              </td>
              <td className="elvt-num">
                {readOnly ? (
                  setting.time
                ) : (
                  <input
                    className="elvt-input elvt-num w-[10ch]"
                    type="time"
                    name={`time_${setting.kind}`}
                    defaultValue={setting.time}
                  />
                )}
              </td>
              <td className="text-txt-secondary">
                {setting.days.length === 0
                  ? "Every day"
                  : setting.days.map((day) => DAY_NAMES[day]).join(", ")}
              </td>
              <td className="text-txt-secondary" data-testid="stops-after">
                {lateInWords(setting.kind)}
              </td>
              <td>
                {readOnly ? (
                  <span className="text-txt-secondary">{setting.enabled ? "Yes" : "No"}</span>
                ) : (
                  <input
                    type="checkbox"
                    name={`on_${setting.kind}`}
                    defaultChecked={setting.enabled}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div>
      <p className="mb-2 max-w-[70ch] text-txt-secondary">
        Anything set within an hour of something else goes out as one message.
        Five pings in a morning is how an app gets muted, and a muted app
        delivers nothing at all.
      </p>

      <p className="mb-3 max-w-[70ch] text-txt-secondary">
        Each one also stops being sent once it stops being true. A weigh-in that
        says &ldquo;before you eat&rdquo; is wrong by mid-morning rather than
        late, so it is dropped for the day instead of arriving after breakfast.
        A session can still be trained, so it waits longer.
      </p>

      {readOnly || !action || !clientId ? (
        body
      ) : (
        <form action={action}>
          <input type="hidden" name="clientId" value={clientId} />
          {body}
          <button className="elvt-button mt-4" type="submit">
            Save the times
          </button>
        </form>
      )}
    </div>
  );
}

function toMinutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0);
}

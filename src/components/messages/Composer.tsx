"use client";

import { useState } from "react";
import { fill, QUICK_REPLIES } from "@/lib/messages/quick-replies";

/**
 * Writing a message.
 *
 * A quick reply fills from the client's own numbers rather than pasting a
 * sentence with a hole where the figure should be. When a value is missing the
 * composer says which, and refuses to insert the template, because a message
 * reading "Steps were  then  against your usual" is worse than no message.
 *
 * Scheduling is in the client's own words and their own time. The instant is
 * worked out server side, since a browser's idea of a timezone is the reader's,
 * not the client's.
 */
export function Composer({
  action,
  clientId,
  values,
  timezoneLabel,
}: {
  action: (formData: FormData) => void;
  clientId: string;
  /** What the portal knows about this client, for filling a quick reply. */
  values: Record<string, string | number>;
  timezoneLabel: string;
}) {
  const [body, setBody] = useState("");
  const [missing, setMissing] = useState<string[]>([]);
  const [schedule, setSchedule] = useState(false);

  return (
    <form action={action} data-testid="composer">
      <input type="hidden" name="clientId" value={clientId} />

      <div className="flex flex-wrap gap-1" data-testid="quick-replies">
        {QUICK_REPLIES.map((template) => (
          <button
            key={template.key}
            type="button"
            data-testid="quick-reply"
            className="elvt-chip text-txt-mute"
            onClick={() => {
              const result = fill(template, values);
              if (!result.ok) {
                setMissing(result.missing);
                return;
              }
              setMissing([]);
              setBody(result.body);
            }}
          >
            {template.name}
          </button>
        ))}
      </div>

      {missing.length > 0 ? (
        <p className="mt-2 text-watch" data-testid="quick-reply-missing">
          That one needs {missing.join(", ")}, and the portal does not have{" "}
          {missing.length === 1 ? "it" : "them"} for this client yet. Write it by
          hand, or fill the gap on their profile first.
        </p>
      ) : null}

      <label className="mt-3 block">
        <span className="elvt-label">Message</span>
        <textarea
          className="elvt-input mt-1 min-h-[120px]"
          name="body"
          data-testid="message-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          required
        />
      </label>

      <label className="mt-3 flex items-center gap-3">
        <input
          type="checkbox"
          name="scheduled"
          checked={schedule}
          onChange={(event) => setSchedule(event.target.checked)}
        />
        <span className="text-txt-mute">Send it later</span>
      </label>

      {schedule ? (
        <div className="mt-2 flex flex-wrap gap-3" data-testid="schedule-fields">
          <label className="block">
            <span className="elvt-label">Date</span>
            <input className="elvt-input elvt-num mt-1" type="date" name="sendDate" required />
          </label>
          <label className="block">
            <span className="elvt-label">Time, {timezoneLabel}</span>
            <input className="elvt-input elvt-num mt-1" type="time" name="sendTime" required />
          </label>
        </div>
      ) : null}

      <label className="mt-3 block">
        <span className="elvt-label">Voice note</span>
        <input
          className="mt-1 w-full text-txt-mute"
          type="file"
          name="voice"
          accept="audio/*"
          data-testid="voice-note"
        />
      </label>

      <button className="elvt-button mt-4" type="submit">
        {schedule ? "Schedule it" : "Send it"}
      </button>
    </form>
  );
}

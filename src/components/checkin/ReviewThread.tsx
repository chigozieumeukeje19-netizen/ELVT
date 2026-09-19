/**
 * The review, as a thread.
 *
 * HubFit's feedback is one way and their own help center lists it as a gap. A
 * client who reads "move the long run to Sunday" and cannot ask why is a client
 * who either does it without understanding it or does not do it at all. So the
 * review opens a thread and the client can answer in it.
 */
export type ThreadMessage = {
  id: string;
  from: "coach" | "client";
  body: string;
  at: string;
};

export function ReviewThread({
  messages,
  action,
  slug,
  submissionId,
  readOnly,
}: {
  messages: ThreadMessage[];
  action?: (formData: FormData) => void;
  slug?: string;
  submissionId?: string;
  readOnly?: boolean;
}) {
  return (
    <div data-testid="review-thread">
      {messages.length === 0 ? (
        <p className="text-txt-mute" data-testid="thread-empty">
          No review yet. What you write here reaches the client and they can
          answer it, so it is a conversation rather than a note.
        </p>
      ) : (
        <ul>
          {messages.map((message) => (
            <li
              key={message.id}
              data-testid="thread-message"
              className="border-line py-3 [border-bottom-width:1px]"
            >
              <p className="elvt-label">
                {message.from === "coach" ? "You" : "Them"}
                <span className="elvt-num ml-3 text-txt-dim">{message.at}</span>
              </p>
              <p className="mt-1 max-w-[70ch] whitespace-pre-line">{message.body}</p>
            </li>
          ))}
        </ul>
      )}

      {!readOnly && action && submissionId && slug ? (
        <form action={action} className="mt-4">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="submissionId" value={submissionId} />
          <label className="block">
            <span className="elvt-label">Your review</span>
            <textarea
              className="elvt-input mt-1 min-h-[96px]"
              name="body"
              data-testid="review-body"
              required
            />
          </label>
          <button className="elvt-button mt-3" type="submit">
            Send it
          </button>
        </form>
      ) : null}
    </div>
  );
}

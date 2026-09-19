/**
 * The two line header every coach screen opens with: a small sentence case
 * label saying where you are, then the one fact the screen is about.
 *
 * Kept to two lines on purpose. Anything taller costs rows the roster and the
 * day grid need above the fold.
 */
export function ScreenHeader({
  label,
  title,
  note,
  error,
  actions,
}: {
  label: string;
  title: string;
  note?: string;
  error?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="elvt-label">{label}</p>
          <h1 className="mt-1 truncate text-h2">{title}</h1>
        </div>
        {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
      </div>

      {note ? <p className="mt-2 max-w-[68ch] text-txt-secondary">{note}</p> : null}

      {error ? (
        <p role="alert" className="mt-3 text-flag">
          {error}
        </p>
      ) : null}
    </header>
  );
}

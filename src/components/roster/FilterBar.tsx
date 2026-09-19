import {
  BULK_LABELS,
  FILTER_LABELS,
  FILTER_NOTES,
  FILTERS,
  type BulkAction,
  type FilterKey,
  type Segment,
} from "@/lib/roster/filters";

/**
 * The filters, their counts, and the saved segments.
 *
 * Every filter carries the number of rows it would leave, counted against what
 * is already on rather than against the whole roster, so the number promises
 * what the click delivers. A filter that would leave nothing is shown and
 * disabled rather than hidden: a coach looking for "race within 6 weeks" needs
 * to see that nobody has one, not to wonder where the button went.
 */
export function FilterBar({
  active,
  counts,
  segments,
  hrefFor,
  segmentHrefFor,
  total,
  showing,
}: {
  active: FilterKey[];
  counts: Record<FilterKey, number>;
  segments: Segment[];
  hrefFor: (key: FilterKey) => string;
  segmentHrefFor: (segment: Segment) => string;
  total: number;
  showing: number;
}) {
  return (
    <div className="mb-4" data-testid="filter-bar">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((key) => {
          const on = active.includes(key);
          const count = counts[key];
          const dead = count === 0 && !on;

          return (
            <a
              key={key}
              href={dead ? undefined : hrefFor(key)}
              aria-current={on ? "page" : undefined}
              aria-disabled={dead ? "true" : undefined}
              title={FILTER_NOTES[key]}
              data-testid="filter"
              data-active={on ? "true" : undefined}
              className={[
                "elvt-chip",
                on ? "bg-raised text-txt" : dead ? "text-txt-tertiary" : "text-txt-secondary",
              ].join(" ")}
            >
              {FILTER_LABELS[key]}
              <span className="elvt-num ml-2 text-txt-tertiary">{count}</span>
            </a>
          );
        })}

        {active.length > 0 ? (
          <a href={hrefFor("needs_attention")} className="elvt-label ml-2 text-txt-secondary" data-testid="clear-filters">
            Clear
          </a>
        ) : null}
      </div>

      {segments.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-2" data-testid="segments">
          <span className="elvt-label text-txt-tertiary">Saved</span>
          {segments.map((segment) => (
            <a key={segment.id} href={segmentHrefFor(segment)} className="elvt-chip text-txt-secondary">
              {segment.name}
            </a>
          ))}
        </div>
      ) : null}

      <p className="mt-2 text-txt-secondary" data-testid="filter-summary">
        {showing === total
          ? `${total} clients`
          : `${showing} of ${total}, filtered`}
      </p>
    </div>
  );
}

/**
 * The bulk bar, which appears only once something is selected.
 *
 * Every button says how many it would change, not how many are ticked. "Pause
 * 6" when two of them are already paused is a button that lies about what it is
 * about to do, and a coach who finds that out once stops using the bar.
 */
export function BulkBar({
  selected,
  actions,
  affects,
  action,
}: {
  selected: number;
  actions: BulkAction[];
  affects: Record<string, number>;
  action: (formData: FormData) => void;
}) {
  if (selected === 0) return null;

  return (
    <form action={action} className="mb-4 flex flex-wrap items-center gap-2" data-testid="bulk-bar">
      <span className="elvt-label" data-testid="bulk-selected">
        {selected} selected
      </span>

      {actions.map((name) => (
        <button
          key={name}
          type="submit"
          name="action"
          value={name}
          className="elvt-chip text-txt-secondary"
          data-testid="bulk-action"
          data-affects={affects[name]}
        >
          {BULK_LABELS[name]}
          <span className="elvt-num ml-2 text-txt-tertiary">{affects[name]}</span>
        </button>
      ))}
    </form>
  );
}

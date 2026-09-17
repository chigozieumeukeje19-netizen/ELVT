import { Field } from "@/components/Field";

/**
 * The week level actions from spec 4.2: duplicate to the next week, duplicate
 * across a range, shift everything a day, swap two days, mark a deload, clear.
 *
 * Plain forms posting to server actions. Each one is a write a coach makes
 * deliberately, so none of them are a drag gesture that could fire by accident.
 */
export function WeekActions({
  weekNumber,
  weekCount,
  isDeload,
  actions,
}: {
  weekNumber: number;
  weekCount: number;
  isDeload: boolean;
  actions?: {
    duplicateWeek: (formData: FormData) => Promise<void>;
    duplicateToRange: (formData: FormData) => Promise<void>;
    shiftWeek: (formData: FormData) => Promise<void>;
    swapDays: (formData: FormData) => Promise<void>;
    setDeload: (formData: FormData) => Promise<void>;
    clearWeek: (formData: FormData) => Promise<void>;
  };
}) {
  // A preview renders the controls without wiring the writes, so the whole
  // screen is measured rather than the half of it that has no side effects.
  const disabled = !actions;
  const hidden = (
    <input type="hidden" name="weekNumber" value={weekNumber} readOnly />
  );

  return (
    <section className="mt-6 border-line pt-4 [border-top-width:1px]">
      <h2 className="elvt-label">This week</h2>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <form action={actions?.duplicateWeek}>
          {hidden}
          <button className="elvt-button-secondary" type="submit" disabled={disabled}>
            Duplicate to next week
          </button>
        </form>

        <form action={actions?.shiftWeek} className="flex items-end gap-2">
          {hidden}
          <Field label="Shift by">
            <select name="days" className="elvt-input" defaultValue="1">
              <option value="1">One day later</option>
              <option value="-1">One day earlier</option>
            </select>
          </Field>
          <button className="elvt-button-secondary" type="submit" disabled={disabled}>
            Shift
          </button>
        </form>

        <form action={actions?.setDeload}>
          {hidden}
          <input type="hidden" name="isDeload" value={isDeload ? "0" : "1"} />
          <button className="elvt-button-secondary" type="submit" disabled={disabled}>
            {isDeload ? "Unmark deload" : "Mark deload"}
          </button>
        </form>

        <form action={actions?.clearWeek}>
          {hidden}
          <button className="elvt-button-secondary" type="submit" disabled={disabled}>
            Clear week
          </button>
        </form>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <form action={actions?.duplicateToRange} className="flex items-end gap-2">
          {hidden}
          <Field label="Copy into weeks">
            <input
              className="elvt-input w-[90px]"
              name="fromWeek"
              type="number"
              min={1}
              max={weekCount}
              defaultValue={Math.min(weekNumber + 1, weekCount)}
            />
          </Field>
          <Field label="through">
            <input
              className="elvt-input w-[90px]"
              name="toWeek"
              type="number"
              min={1}
              max={weekCount}
              defaultValue={weekCount}
            />
          </Field>
          <button className="elvt-button-secondary" type="submit" disabled={disabled}>
            Duplicate across
          </button>
        </form>

        <form action={actions?.swapDays} className="flex items-end gap-2">
          {hidden}
          <Field label="Swap">
            <select name="dayA" className="elvt-input" defaultValue="1">
              {DAY_OPTIONS}
            </select>
          </Field>
          <Field label="with">
            <select name="dayB" className="elvt-input" defaultValue="4">
              {DAY_OPTIONS}
            </select>
          </Field>
          <button className="elvt-button-secondary" type="submit" disabled={disabled}>
            Swap days
          </button>
        </form>
      </div>
    </section>
  );
}

const DAY_OPTIONS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
].map((name, index) => (
  <option key={name} value={index}>
    {name}
  </option>
));

import { Field, Select } from "@/components/Field";
import { PATH_SHAPES } from "@/lib/nutrition/calorie-path";

/**
 * Regenerating the path. A form, not a wizard: six numbers and a shape.
 *
 * It says what it will overwrite before it does it. Regenerating throws away
 * weeks the coach confirmed or edited by hand, and finding that out afterwards
 * is the kind of thing that stops a coach trusting the button.
 */
export function RegeneratePath({
  action,
  slug,
  defaults,
  confirmedWeeks,
}: {
  action: (formData: FormData) => void;
  slug: string;
  defaults: {
    weekCount: number;
    startCalories: number;
    endCalories: number;
    protein: number;
    deloadWeeks: string;
    shape: string;
  };
  confirmedWeeks: number[];
}) {
  return (
    <form action={action} data-testid="regenerate-path">
      <input type="hidden" name="slug" value={slug} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Field label="Weeks">
          <input className="elvt-input" name="weekCount" type="number" min={1} max={52} defaultValue={defaults.weekCount} required />
        </Field>
        <Field label="Start calories">
          <input className="elvt-input" name="startCalories" type="number" min={800} max={8000} defaultValue={defaults.startCalories} required />
        </Field>
        <Field label="Goal calories">
          <input className="elvt-input" name="endCalories" type="number" min={800} max={8000} defaultValue={defaults.endCalories} required />
        </Field>
        <Field label="Protein, grams">
          <input className="elvt-input" name="protein" type="number" min={40} max={400} defaultValue={defaults.protein} required />
        </Field>
        <Field label="Deload weeks">
          <input className="elvt-input" name="deloadWeeks" type="text" inputMode="numeric" placeholder="4, 8" defaultValue={defaults.deloadWeeks} />
        </Field>
        <Field label="Shape">
          <Select name="shape" options={PATH_SHAPES} defaultValue={defaults.shape} />
        </Field>
      </div>

      {confirmedWeeks.length > 0 ? (
        <p className="mt-3 text-watch" data-testid="regenerate-warning">
          {confirmedWeeks.length === 1
            ? `Week ${confirmedWeeks[0]} was set by hand and regenerating replaces it.`
            : `Weeks ${confirmedWeeks.join(", ")} were set by hand and regenerating replaces them.`}
        </p>
      ) : null}

      <button className="elvt-button mt-4" type="submit">
        Regenerate the path
      </button>
    </form>
  );
}

/**
 * Form primitives. These exist so a label, an input and a select are spelled
 * the same way on every screen, which is most of what keeps spacing consistent.
 */

export function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="elvt-label">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

export function Select({
  name,
  options,
  defaultValue,
  includeBlank,
  required,
}: {
  name: string;
  options: readonly string[];
  defaultValue?: string | null;
  includeBlank?: string;
  required?: boolean;
}) {
  return (
    <select
      name={name}
      required={required}
      defaultValue={defaultValue ?? ""}
      className="elvt-input"
    >
      {includeBlank ? <option value="">{includeBlank}</option> : null}
      {options.map((option) => (
        <option key={option} value={option}>
          {humanize(option)}
        </option>
      ))}
    </select>
  );
}

/**
 * Stored values are snake case. Nothing in this product renders a raw enum, so
 * every one of them comes through here on the way to a screen.
 *
 * A handful do not survive a mechanical rewrite: push_v reads as "Push v",
 * which is not a phrase anyone says. Those are named explicitly.
 */
const NAMED: Record<string, string> = {
  push_h: "Horizontal push",
  push_v: "Vertical push",
  pull_h: "Horizontal pull",
  pull_v: "Vertical pull",
  pct_1rm: "Percent of 1RM",
  rir: "Reps in reserve",
  rpe: "Rate of perceived exertion",
  e1rm: "Estimated 1RM",
  amrap: "As many rounds as possible",
  lower_strength: "Lower body strength",
  upper_strength: "Upper body strength",
  full_strength: "Full body strength",
  hard_run: "Hard run",
  easy_run: "Easy run",
  long_run: "Long run",
  race_pace: "Race pace",
  walk_run: "Walk run",
  zone2: "Zone 2",
  front_loaded: "Front loaded",
  mileage_linked: "Mileage linked",
  muscle_gain: "Muscle gain",
  fat_loss: "Fat loss",
  race_prep: "Race prep",
  fitness_test: "Fitness test",
  pending_approval: "Pending approval",
  checkin_due: "Check-in due",
  checkin_submitted: "Check-in submitted",
  retention_risk: "Retention risk",
  weight_flag: "Weight flag",
  mileage_spike: "Mileage spike",
  monday_review: "Monday review",
  step_goal: "Step goal",
  training_volume: "Training volume",
  training_days: "Training days",
  session_order: "Session order",
  run_volume: "Run volume",
  long_run_day: "Long run day",
  run_intensity: "Run intensity",
  exercise_swap: "Exercise swap",
  sleep_target: "Sleep target",
  recovery_work: "Recovery work",
  message_cadence: "Message cadence",
  nothing_yet: "Nothing yet",
  return_to_training: "Return to training",
  hands_off: "Hands off",
  close_contact: "Close contact",
  progress_photos: "Progress photos",
  star_rating: "Star rating",
  multiple_choice: "Multiple choice",
  yes_no: "Yes or no",
  morning_plan: "Morning plan",
  evening_reflection: "Evening reflection",
  weigh_in: "Weigh in",
};

export function humanize(value: string): string {
  if (NAMED[value]) return NAMED[value];
  const words = value.replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

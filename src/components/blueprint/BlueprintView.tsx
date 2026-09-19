import { humanize } from "@/components/Field";
import type { Blueprint } from "@/lib/blueprint/types";

/**
 * The Blueprint as the coach reads it before approving.
 *
 * The drafted half is editable and the derived half is not, and the screen says
 * which is which. Those facts came from the client, so a coach who disagrees
 * with one is disagreeing with what the client typed, and the place to fix that
 * is the intake, not here.
 */
export function BlueprintView({ blueprint }: { blueprint: Blueprint }) {
  const { derived, drafted } = blueprint;

  return (
    <div className="grid gap-6 lg:grid-cols-2" data-testid="blueprint-view">
      <section className="min-w-0">
        <h2 className="elvt-label">What they told us</h2>
        <p className="mt-1 text-txt-tertiary">
          Straight from the intake. Not editable here, and never written by an
          AI draft.
        </p>

        <dl className="mt-3" data-testid="derived-facts">
          <Fact label="Goal" value={humanize(derived.goalType)} />
          <Fact label="In their words" value={derived.goalStatement || "Not stated"} />
          <Fact label="Block" value={`${derived.durationWeeks} weeks`} />
          <Fact
            label="Training"
            value={`${derived.daysPerWeek} days, ${derived.sessionMinutes} minutes`}
          />
          <Fact label="Days" value={derived.preferredDays.join(", ") || "No preference"} />
          <Fact label="Equipment" value={derived.equipment.join(", ") || "Not stated"} />
          <Fact
            label="Running"
            value={
              derived.runs
                ? `${derived.weeklyMileage ?? "unknown"} miles a week${derived.raceDate ? `, race ${derived.raceDate}` : ""}`
                : "None"
            }
          />
          <Fact label="Nutrition" value={derived.nutritionStructure || "Not stated"} />
          <Fact label="Start weight" value={derived.startWeight ? `${derived.startWeight}` : "Not given"} />
          <Fact label="Goal weight" value={derived.goalWeight ? `${derived.goalWeight}` : "None set"} />
          <Fact label="Steps" value={derived.stepGoal ? `${derived.stepGoal}` : "Not given"} />
          <Fact label="Sleep" value={derived.sleepHours ? `${derived.sleepHours} hours` : "Not given"} />
          <Fact
            label="Flags"
            value={derived.flags.map(humanize).join(", ") || "None"}
            emphasis={derived.flags.length > 0}
          />
          <Fact label="Medical" value={derived.medical.join("; ") || "Nothing noted"} />
          <Fact label="Constraints" value={derived.constraints.join("; ") || "None"} />
          <Fact label="Tone asked for" value={humanize(derived.tone)} />
        </dl>
      </section>

      <section className="min-w-0">
        <h2 className="elvt-label">The draft</h2>
        <p className="mt-1 text-txt-tertiary">
          Editable. Nothing reaches the client until you approve it.
        </p>

        <div className="mt-3 flex flex-col gap-4" data-testid="drafted-prose">
          <Prose label="Summary" text={drafted.summary} />
          <Prose label="The one thing" text={drafted.oneThing} />
          <Prose label="Likely failure mode" text={drafted.failureMode} />
          <Prose label="How to write to them" text={drafted.toneNotes} />
        </div>

        {drafted.triggers.length > 0 ? (
          <div className="mt-5">
            <h3 className="elvt-label">Proposed triggers</h3>
            <p className="mt-1 text-txt-tertiary">
              From their own numbers, not from a house default.
            </p>
            <ul className="mt-2" data-testid="proposed-triggers">
              {drafted.triggers.map((trigger) => (
                <li
                  key={trigger.key}
                  className="flex h-row items-center justify-between gap-3 border-line [border-bottom-width:1px]"
                >
                  <span className="min-w-0 truncate">{trigger.name}</span>
                  <span className="elvt-num shrink-0">{trigger.threshold}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Fact({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex gap-4 border-line py-2 [border-bottom-width:1px]">
      <dt className="elvt-label w-[14ch] shrink-0">{label}</dt>
      <dd className={`min-w-0 flex-1 break-words ${emphasis ? "text-flag" : ""}`}>{value}</dd>
    </div>
  );
}

function Prose({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="elvt-label">{label}</p>
      <p className="mt-1 max-w-[70ch]">
        {text || <span className="text-txt-tertiary">Not drafted yet.</span>}
      </p>
    </div>
  );
}

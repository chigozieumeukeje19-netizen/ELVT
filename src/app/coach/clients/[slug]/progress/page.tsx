import { notFound, redirect } from "next/navigation";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ProgressTable } from "@/components/progress/ProgressTable";
import { TrendChart } from "@/components/progress/TrendChart";
import { currentProfile, isStaff } from "@/lib/auth";
import type { GoalType } from "@/lib/blueprint/types";
import { localDate } from "@/lib/engine/clock";
import {
  buildSeries,
  defaultsFor,
  everythingElse,
  RANGES,
  withinRange,
  type Metric,
  type Point,
  type RangeKey,
} from "@/lib/progress/metrics";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Where this person is going.
 *
 * Opens on the four metrics their phase is about, because showing everything
 * shows nothing. Everything else is one link away and the link says how many it
 * adds rather than being an unlabelled expander.
 */
export default async function ProgressPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ range?: string; all?: string; view?: string }>;
}) {
  const profile = await currentProfile();
  if (!profile) redirect("/login");
  if (!isStaff(profile.role)) redirect("/client/today");

  const { slug } = await params;
  const { range: rangeParam, all, view } = await searchParams;
  const supabase = await supabaseServer();

  const { data: client } = await supabase
    .from("clients")
    .select("id, first_name, last_name, primary_goal, timezone")
    .eq("slug", slug)
    .maybeSingle();
  if (!client) notFound();

  const name = [client.first_name, client.last_name].filter(Boolean).join(" ");
  const goal = (client.primary_goal as GoalType) ?? "recomp";
  const showAll = all === "1";
  const asTable = view === "table";

  const range: RangeKey = RANGES.some((entry) => entry.key === rangeParam)
    ? (rangeParam as RangeKey)
    : "84d";

  const metrics: Metric[] = showAll
    ? [...defaultsFor(goal), ...everythingElse(goal)]
    : defaultsFor(goal);

  const today = localDate(new Date(), client.timezone || "UTC");

  const { data: logs } = await supabase
    .from("daily_logs")
    .select("date, weight, steps, water, sleep_hours, energy, mood, readiness")
    .eq("client_id", client.id)
    .order("date");

  const { data: weeks } = await supabase
    .from("program_weeks")
    .select("starts_on, calories, protein, planned_mileage, elvt_score, adherence")
    .eq("client_id", client.id)
    .order("starts_on");

  const series = metrics.map((metric) => {
    const points: Point[] =
      metric === "calories" || metric === "protein" || metric === "mileage" ||
      metric === "elvt_score" || metric === "adherence"
        ? (weeks ?? []).map((week) => ({
            date: week.starts_on,
            value: weeklyValue(metric, week),
          }))
        : (logs ?? []).map((log) => ({
            date: log.date,
            value:
              (log as Record<string, unknown>)[metric] === null ||
              (log as Record<string, unknown>)[metric] === undefined
                ? null
                : Number((log as Record<string, unknown>)[metric]),
          }));

    return buildSeries(metric, withinRange(points, range, today));
  });

  const base = `/coach/clients/${slug}/progress`;
  const query = (overrides: Record<string, string | undefined>) => {
    const next = new URLSearchParams({
      range,
      ...(showAll ? { all: "1" } : {}),
      ...(asTable ? { view: "table" } : {}),
    });
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) next.delete(key);
      else next.set(key, value);
    }
    return `${base}?${next.toString()}`;
  };

  return (
    <main className="px-5 py-4">
      <ScreenHeader
        label="Progress"
        title={name}
        note={
          showAll
            ? `Everything, ${metrics.length} metrics`
            : `The four their phase is about. ${everythingElse(goal).length} more behind Show everything.`
        }
        actions={
          <>
            <a className="elvt-button-secondary" href={query({ view: asTable ? undefined : "table" })}>
              {asTable ? "Charts" : "Table"}
            </a>
            <a
              className="elvt-button-secondary"
              href={`/coach/clients/${slug}/progress/export?range=${range}${showAll ? "&all=1" : ""}`}
            >
              Download CSV
            </a>
          </>
        }
      />

      {/* Filters in one row above the charts. */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <nav aria-label="Date range" className="flex gap-1">
          {RANGES.map((entry) => (
            <a
              key={entry.key}
              href={query({ range: entry.key })}
              aria-current={entry.key === range ? "page" : undefined}
              className={`elvt-chip ${entry.key === range ? "bg-panel-2 text-txt" : "text-txt-mute"}`}
            >
              {entry.label}
            </a>
          ))}
        </nav>

        <a
          href={query({ all: showAll ? undefined : "1" })}
          className={`elvt-chip ${showAll ? "bg-panel-2 text-txt" : "text-txt-mute"}`}
          data-testid="show-everything"
        >
          {showAll ? "Just their phase" : `Show everything, ${everythingElse(goal).length} more`}
        </a>
      </div>

      {asTable ? (
        <ProgressTable series={series} />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3" data-testid="trend-grid">
          {series.map((one) => (
            <TrendChart key={one.metric} series={one} />
          ))}
        </div>
      )}
    </main>
  );
}

function weeklyValue(metric: Metric, week: Record<string, unknown>): number | null {
  if (metric === "mileage") {
    return week.planned_mileage === null ? null : Number(week.planned_mileage);
  }
  if (metric === "adherence") {
    const adherence = (week.adherence ?? {}) as Record<string, { done: number; planned: number }>;
    const entries = Object.values(adherence).filter((entry) => entry.planned > 0);
    if (entries.length === 0) return null;
    const total = entries.reduce((sum, entry) => sum + entry.done / entry.planned, 0);
    return Math.round((total / entries.length) * 100);
  }
  const value = week[metric];
  return value === null || value === undefined ? null : Number(value);
}

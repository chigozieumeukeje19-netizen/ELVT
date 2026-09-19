import { NextResponse, type NextRequest } from "next/server";
import { currentProfile, isStaff } from "@/lib/auth";
import type { GoalType } from "@/lib/blueprint/types";
import { localDate } from "@/lib/engine/clock";
import {
  buildSeries,
  defaultsFor,
  everythingElse,
  toCsv,
  withinRange,
  type Metric,
  type Point,
  type RangeKey,
} from "@/lib/progress/metrics";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * The CSV of exactly what is on screen.
 *
 * Every reading, not a summary. The point of an export is that the coach can do
 * something the portal does not, and CoachRx's own reviews name the lack of one
 * as a complaint, so this carries the raw rows.
 */
export async function GET(
  request: NextRequest,
  route: { params: Promise<{ slug: string }> },
) {
  const profile = await currentProfile();
  if (!profile || !isStaff(profile.role)) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const { slug } = await route.params;
  const url = new URL(request.url);
  const range = (url.searchParams.get("range") ?? "84d") as RangeKey;
  const showAll = url.searchParams.get("all") === "1";

  const supabase = await supabaseServer();
  const { data: client } = await supabase
    .from("clients")
    .select("id, primary_goal, timezone")
    .eq("slug", slug)
    .maybeSingle();

  if (!client) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const goal = (client.primary_goal as GoalType) ?? "recomp";
  const metrics: Metric[] = showAll
    ? [...defaultsFor(goal), ...everythingElse(goal)]
    : defaultsFor(goal);

  const today = localDate(new Date(), client.timezone || "UTC");

  const { data: logs } = await supabase
    .from("daily_logs")
    .select("date, weight, steps, water, sleep_hours, energy, mood, readiness")
    .eq("client_id", client.id)
    .order("date");

  const series = metrics
    .filter((metric) => (logs ?? []).length > 0)
    .map((metric) => {
      const points: Point[] = (logs ?? []).map((log) => {
        const value = (log as Record<string, unknown>)[metric];
        return {
          date: log.date,
          value: value === null || value === undefined ? null : Number(value),
        };
      });
      return buildSeries(metric, withinRange(points, range, today));
    });

  return new NextResponse(toCsv(series), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${slug}-progress-${range}.csv"`,
      "cache-control": "no-store",
    },
  });
}

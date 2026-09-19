import { NextResponse } from "next/server";
import { handler } from "@/lib/api/context";

export const dynamic = "force-dynamic";

const ALLOWED = [
  "weight", "steps", "water", "sleep_hours", "energy", "mood", "readiness",
] as const;

/**
 * GET /api/v1/progress?metrics=&from=&to=
 *
 * The metrics list is an allow list rather than a column name passed through.
 * It arrives from a client app and goes into a select, and "the caller asked
 * for it" is not a reason to read an arbitrary column.
 */
export const GET = handler(async ({ clientId, db }, request) => {
  const url = new URL(request.url);
  const requested = (url.searchParams.get("metrics") ?? "").split(",").filter(Boolean);
  const metrics = requested.length
    ? requested.filter((metric) => (ALLOWED as readonly string[]).includes(metric))
    : [...ALLOWED];

  if (requested.length > 0 && metrics.length === 0) {
    return NextResponse.json({ error: "None of those metrics exist." }, { status: 400 });
  }

  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  let query = db
    .from("daily_logs")
    .select(["date", ...metrics].join(", "))
    .eq("client_id", clientId)
    .order("date");

  if (from) query = query.gte("date", from);
  if (to) query = query.lte("date", to);

  const { data: rows } = await query;

  return NextResponse.json({ metrics, from, to, rows: rows ?? [] });
});

import { NextResponse } from "next/server";
import { handler } from "@/lib/api/context";

export const dynamic = "force-dynamic";

/** GET /api/v1/milestones. Achieved and pending, with anything to celebrate. */
export const GET = handler(async ({ clientId, db }) => {
  const [{ data: achieved }, { data: celebrations }] = await Promise.all([
    db
      .from("client_milestones")
      .select("id, milestone_id, custom_name, achieved_at, status, milestones(key, name, description, category)")
      .eq("client_id", clientId)
      .order("achieved_at", { ascending: false }),
    db
      .from("celebrations")
      .select("id, client_milestone_id, headline, number_shown, shown_at")
      .eq("client_id", clientId)
      .is("shown_at", null),
  ]);

  return NextResponse.json({
    milestones: achieved ?? [],
    // Not yet shown. The client app renders one full screen card and marks it,
    // rather than a pile of confetti on every open.
    to_celebrate: celebrations ?? [],
  });
});

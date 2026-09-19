import { NextResponse } from "next/server";
import { handlerWithParams } from "@/lib/api/context";

export const dynamic = "force-dynamic";

/** GET /api/v1/nutrition/:date. Target, meals, what was logged, what is left. */
export const GET = handlerWithParams<{ date: string }>(async ({ clientId, db }, _request, params) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.date)) {
    return NextResponse.json({ error: "That is not a date." }, { status: 400 });
  }

  const { data: day } = await db
    .from("program_days")
    .select("calories_override, protein_override")
    .eq("date", params.date)
    .maybeSingle();

  const { data: week } = await db
    .from("program_weeks")
    .select("calories, protein, carbs, fat")
    .eq("client_id", clientId)
    .lte("starts_on", params.date)
    .order("starts_on", { ascending: false })
    .limit(1)
    .maybeSingle();

  const [{ data: meals }, { data: logs }] = await Promise.all([
    db.from("meals").select("id, name, order, calories, protein, carbs, fat, items").eq("client_id", clientId).order("order"),
    db.from("meal_logs").select("id, meal_id, custom, source").eq("client_id", clientId).eq("date", params.date),
  ]);

  const target = {
    calories: day?.calories_override ?? week?.calories ?? null,
    protein: day?.protein_override ?? week?.protein ?? null,
    carbs: week?.carbs ?? null,
    fat: week?.fat ?? null,
  };

  // What has gone in. A ticked plan meal counts its own numbers; a custom entry
  // counts what the client typed, which is never per 100g math.
  let eaten = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  for (const log of logs ?? []) {
    const meal = (meals ?? []).find((candidate) => candidate.id === log.meal_id);
    const custom = (log.custom ?? {}) as { kcal?: number; p?: number; c?: number; f?: number };
    eaten = {
      calories: eaten.calories + (meal?.calories ?? custom.kcal ?? 0),
      protein: eaten.protein + (meal?.protein ?? custom.p ?? 0),
      carbs: eaten.carbs + (meal?.carbs ?? custom.c ?? 0),
      fat: eaten.fat + (meal?.fat ?? custom.f ?? 0),
    };
  }

  return NextResponse.json({
    date: params.date,
    target,
    meals: meals ?? [],
    logs: logs ?? [],
    eaten,
    remaining: {
      calories: target.calories === null ? null : target.calories - eaten.calories,
      protein: target.protein === null ? null : target.protein - eaten.protein,
    },
  });
});

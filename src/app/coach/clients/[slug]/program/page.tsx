import { notFound, redirect } from "next/navigation";
import { ScreenHeader } from "@/components/ScreenHeader";
import { PeriodizationGrid } from "@/components/program/PeriodizationGrid";
import { StressRail } from "@/components/program/StressRail";
import { WeekActions } from "@/components/program/WeekActions";
import { WeekStrip } from "@/components/program/WeekStrip";
import { currentProfile, isStaff } from "@/lib/auth";
import { loadProgram } from "@/lib/program/load";
import { buildPeriodizationRows, buildProgramView } from "@/lib/program/view";
import { supabaseServer } from "@/lib/supabase/server";
import { DayGridClient } from "./DayGridClient";
import {
  clearWeekAction,
  duplicateToRangeAction,
  duplicateWeekAction,
  moveSessionAction,
  setDeloadAction,
  shiftWeekAction,
  swapDaysAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function ClientProgramPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ week?: string; error?: string }>;
}) {
  const profile = await currentProfile();
  if (!profile) redirect("/login");
  if (!isStaff(profile.role)) redirect("/client/today");

  const { slug } = await params;
  const { week: weekParam, error } = await searchParams;
  const supabase = await supabaseServer();

  const { data: client } = await supabase
    .from("clients")
    .select("id, first_name, last_name, slug")
    .eq("slug", slug)
    .maybeSingle();

  if (!client) notFound();

  const name = [client.first_name, client.last_name].filter(Boolean).join(" ");

  const { data: programRow } = await supabase
    .from("programs")
    .select("id, name")
    .eq("client_id", client.id)
    .eq("status", "active")
    .maybeSingle();

  if (!programRow) {
    return (
      <main className="px-5 py-4">
        <ScreenHeader
          label="Program"
          title={name}
          error={error}
          note="No program yet. Pick a template in the Builder and apply it, and the block materializes here with this client's flags and preferred days already applied."
        />
      </main>
    );
  }

  const loaded = await loadProgram(supabase, programRow.id);
  if (!loaded) notFound();

  const view = buildProgramView(loaded.program, loaded.phases);
  const currentWeek = Math.min(
    Math.max(1, Number(weekParam ?? 1) || 1),
    Math.max(1, view.weeks.length),
  );
  const week = view.weeks.find((w) => w.weekNumber === currentWeek) ?? view.weeks[0];

  if (!week) {
    return (
      <main className="px-5 py-4">
        <ScreenHeader
          label="Program"
          title={name}
          note="This program has no weeks on it yet."
        />
      </main>
    );
  }

  const bind = (action: (formData: FormData) => Promise<void>) => {
    return async (formData: FormData) => {
      "use server";
      formData.set("slug", slug);
      await action(formData);
    };
  };

  return (
    <main className="px-5 py-4">
      <ScreenHeader
        label="Program"
        title={name}
        note={`${programRow.name}, week ${week.weekNumber} of ${view.weeks.length}`}
        error={error}
      />

      <WeekStrip
        weeks={view.weeks}
        currentWeek={currentWeek}
        hrefFor={(n) => `/coach/clients/${slug}/program?week=${n}`}
      />

      <div className="mt-4 flex gap-5">
        <div className="min-w-0 flex-1">
          <DayGridClient
            week={week}
            peakDayStress={view.peakDayStress}
            slug={slug}
            move={moveSessionAction}
          />

          <WeekActions
            weekNumber={week.weekNumber}
            weekCount={view.weeks.length}
            isDeload={week.isDeload}
            actions={{
              duplicateWeek: bind(duplicateWeekAction),
              duplicateToRange: bind(duplicateToRangeAction),
              shiftWeek: bind(shiftWeekAction),
              swapDays: bind(swapDaysAction),
              setDeload: bind(setDeloadAction),
              clearWeek: bind(clearWeekAction),
            }}
          />
        </div>

        <StressRail week={week} />
      </div>

      <section className="mt-7 border-line pt-5 [border-top-width:1px]">
        <h2 className="elvt-label">Periodization</h2>
        <p className="mt-2 max-w-[68ch] text-txt-secondary">
          One movement per row, one column per week. Edit a lift across the whole
          block rather than a week at a time.
        </p>
        <div className="mt-3">
          <PeriodizationGrid
            rows={buildPeriodizationRows(loaded.program)}
            weekCount={view.weeks.length}
            currentWeek={currentWeek}
          />
        </div>
      </section>
    </main>
  );
}

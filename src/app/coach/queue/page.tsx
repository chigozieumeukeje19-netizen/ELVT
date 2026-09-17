import { redirect } from "next/navigation";
import { currentProfile, isStaff } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Queue is the coach home. Block D builds the attention items and the Monday
 * review cards; for now it proves the session, the role gate and the roster
 * read all work end to end.
 */
export default async function QueuePage() {
  const profile = await currentProfile();
  if (!profile) redirect("/login");
  if (!isStaff(profile.role)) redirect("/client/today");

  const supabase = await supabaseServer();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, slug, first_name, last_name, status, primary_goal")
    .order("first_name");

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <p className="elvt-label">Queue</p>
      <h1 className="mt-2 text-3xl font-semibold">
        Good morning, {profile.display_name ?? "coach"}
      </h1>
      <p className="mt-2 text-mut" data-testid="queue-empty">
        Nothing needs you right now.
      </p>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Roster</h2>
        <ul className="mt-4 space-y-2" data-testid="roster">
          {(clients ?? []).map((c) => (
            <li
              key={c.id}
              className="elvt-panel flex items-center justify-between p-4"
            >
              <span className="font-medium">
                {c.first_name} {c.last_name}
              </span>
              <span className="elvt-label">{c.primary_goal}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SettingsView } from "@/components/settings/SettingsView";
import { currentProfile, isStaff } from "@/lib/auth";
import { THEME_COOKIE, readTheme } from "@/lib/design/theme";
import { aiEnabled } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Settings.
 *
 * The sidebar has linked here since the shell was built and there was nothing
 * on the other end, so every coach who clicked it got a 404. This is the
 * smallest page that makes the link honest: who you are signed in as, the one
 * preference the portal actually stores, and a straight answer about where the
 * settings that are not here live.
 *
 * It invents nothing. There is no coach settings table, so this writes to none:
 * the theme is a cookie and everything else on the page is read.
 */
export default async function SettingsPage() {
  const profile = await currentProfile();
  if (!profile) redirect("/login");
  if (!isStaff(profile.role)) redirect("/client/today");

  return (
    <SettingsView
      name={profile.display_name}
      email={profile.email}
      role={profile.role === "admin" ? "admin" : "coach"}
      timezone={profile.timezone}
      theme={readTheme((await cookies()).get(THEME_COOKIE)?.value)}
      ai={aiEnabled()}
    />
  );
}

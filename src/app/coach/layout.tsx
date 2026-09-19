import { cookies } from "next/headers";
import { Sidebar } from "@/components/Sidebar";
import { THEME_COOKIE, readTheme } from "@/lib/design/theme";

/**
 * The coach shell. Sidebar at 248px on the page surface, main content fills
 * the rest. No top bar: every screen states its own subject in its first line,
 * and a second chrome band would cost rows the roster needs. The theme toggle
 * DESIGN_V2.md 3.1 puts in that bar sits in the sidebar footer instead, which
 * is recorded in docs/OPEN_QUESTIONS.md.
 */
export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const theme = readTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <div className="min-h-screen bg-page">
      <Sidebar theme={theme} />
      <div className="pl-rail lg:pl-sidebar">{children}</div>
    </div>
  );
}

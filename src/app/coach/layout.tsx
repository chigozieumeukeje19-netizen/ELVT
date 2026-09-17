import { headers } from "next/headers";
import { Sidebar } from "@/components/Sidebar";

/**
 * The coach shell. Sidebar fixed at 240px, main content fills the rest.
 * No top bar: every screen states its own subject in its first line, and a
 * second chrome band would cost rows the roster needs.
 */
export default async function CoachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = (await headers()).get("x-pathname") ?? "/coach/queue";

  return (
    <div className="min-h-screen bg-ink">
      <Sidebar current={pathname} />
      <div className="pl-sidebar">{children}</div>
    </div>
  );
}

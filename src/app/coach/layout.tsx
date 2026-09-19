import { Sidebar } from "@/components/Sidebar";

/**
 * The coach shell. Sidebar fixed at 240px, main content fills the rest.
 * No top bar: every screen states its own subject in its first line, and a
 * second chrome band would cost rows the roster needs.
 */
export default function CoachLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ink">
      <Sidebar />
      <div className="pl-rail lg:pl-sidebar">{children}</div>
    </div>
  );
}

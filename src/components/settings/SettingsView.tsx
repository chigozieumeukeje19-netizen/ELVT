import Link from "next/link";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Theme } from "@/lib/design/theme";

/**
 * Settings, as markup.
 *
 * Separated from the page so the preview route can render it against a fixture
 * and the review capture sees the screen. Every value it shows is passed in;
 * it reads nothing.
 */
export function SettingsView({
  name,
  email,
  role,
  timezone,
  theme,
  ai,
}: {
  name: string | null;
  email: string;
  role: "coach" | "admin";
  timezone: string;
  theme: Theme;
  ai: boolean;
}) {
  return (
    <main className="max-w-page px-5 py-4">
      <ScreenHeader
        label="Settings"
        title={name ?? email}
        note="What the portal knows about you, and where the rest of the settings are."
      />

      <section className="elvt-card p-5" data-testid="settings-account">
        <h2 className="text-h3">Account</h2>
        <dl className="mt-3">
          {[
            ["Name", name ?? "Not set"],
            ["Email", email],
            ["Role", role === "admin" ? "Admin" : "Coach"],
            ["Time zone", timezone],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 py-2">
              <dt className="text-txt-secondary">{label}</dt>
              <dd className="text-right">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 max-w-[68ch] text-small text-txt-tertiary">
          These come from your profile row. Changing them is not built yet, so
          they are shown rather than offered as fields you cannot save.
        </p>
      </section>

      <section className="elvt-card mt-4 p-5" data-testid="settings-appearance">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-h3">Appearance</h2>
            <p className="mt-1 max-w-[68ch] text-txt-secondary">
              Currently {theme}. The same toggle sits at the bottom of the
              sidebar on every screen. It is kept in a cookie, so the server
              knows before the page paints and you never see the wrong theme
              first.
            </p>
          </div>
          <ThemeToggle theme={theme} />
        </div>
      </section>

      <section className="elvt-card mt-4 p-5" data-testid="settings-elsewhere">
        <h2 className="text-h3">Settings that live somewhere else</h2>
        <ul className="mt-3">
          <li className="py-2">
            <span className="text-txt">Reminders</span>
            <p className="max-w-[68ch] text-txt-secondary">
              Set per client, on their check-ins tab, because the schedule
              belongs to the person being reminded rather than to you.
            </p>
          </li>
          <li className="py-2">
            <Link href="/coach/builder/exercises/review" className="text-txt underline">
              The exercise library and the question bank
            </Link>
            <p className="max-w-[68ch] text-txt-secondary">
              Both are in the Builder. They are shared across every client, so
              they are content rather than a preference.
            </p>
          </li>
          <li className="py-2">
            <span className="text-txt">
              AI drafting is {ai ? "on" : "off"}
            </span>
            <p className="max-w-[68ch] text-txt-secondary">
              {ai
                ? "Drafts are generated in the portal. You still approve every one before it reaches a client."
                : "Every AI job gives you a prompt to copy and a box to paste the answer into, so the portal never calls a paid endpoint on its own. This is set on the server, not here."}
            </p>
          </li>
        </ul>
      </section>
    </main>
  );
}

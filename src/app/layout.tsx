import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { THEME_COOKIE, readTheme } from "@/lib/design/theme";
import "@/styles/globals.css";

/**
 * The typeface, and the one it replaced. DESIGN_V2.md 1.2.
 *
 * Archivo carries the whole interface, the numbers included: tabular figures
 * align a column without a second face, and the data then reads as part of the
 * product rather than as a terminal readout. It is off the autopilot list in
 * DESIGN.md tell 8, which the scaffold's first choice was on.
 *
 * The mono face is still loaded, for the two places v2 permits it: an id shown
 * to a developer and a raw timestamp. It reaches no figure.
 */
const ui = Archivo({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
  axes: ["wdth"],
});

/**
 * An id shown to a developer, and a raw timestamp. That is the whole list.
 *
 * v1 put every weight, calorie, mile and score in this face. v2 retires it for
 * data: `.elvt-num` gets tabular figures out of Archivo, which aligns the
 * column without making the product read as a terminal readout.
 */
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "ELVT OS",
  description: "Coaching portal for ELVT.",
};

/**
 * The theme is decided here, on the server, from a cookie.
 *
 * DESIGN_V2.md 2.2: light is not an afterthought. Resolving it before the first
 * byte means the page never paints in the wrong theme and then corrects itself,
 * which is what a client-side read of localStorage would do.
 */
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = readTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <html lang="en-US" data-theme={theme} className={`${ui.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}

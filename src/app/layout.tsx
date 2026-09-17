import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import "@/styles/globals.css";

/**
 * Type pairing, chosen for two different jobs. DESIGN.md Part 2.
 *
 * Archivo carries the whole interface. It is a grotesk with a real width axis,
 * so section labels can be set small, wide and uppercase with tracking, which
 * is how timing and telemetry screens label things. It is off the autopilot
 * list in DESIGN.md tell 8, which the scaffold's first choice was on.
 */
const ui = Archivo({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
  axes: ["wdth"],
});

/**
 * Every figure that sits in a column or gets compared: weights, calories,
 * mileage, scores, dates, percentages. Monospaced tabular figures mean digits
 * line up down a column without extra CSS. Prose never uses it.
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-US" className={`${ui.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}

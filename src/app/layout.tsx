import type { Metadata } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import "@/styles/globals.css";

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

/**
 * Heading face decision: Inter Tight, not a serif. The brand is monochrome
 * with a single gold accent, so a second typeface with its own personality
 * fights the palette. Inter Tight gives headlines their own weight and
 * tracking while staying inside the Inter family.
 */
const heading = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
  weight: ["500", "600", "700"],
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
    <html lang="en-US" className={`${body.variable} ${heading.variable}`}>
      <body>{children}</body>
    </html>
  );
}

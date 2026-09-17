import type { Config } from "tailwindcss";

/**
 * Theme tokens are declared once as CSS variables in src/styles/globals.css
 * (the light cream palette carried over from the v1 client apps) and mapped
 * here so Tailwind utilities and raw CSS never drift apart.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        panel: "var(--panel)",
        panel2: "var(--panel2)",
        line: "var(--line)",
        txt: "var(--txt)",
        mut: "var(--mut)",
        gold: "var(--gold)",
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
        elvt: "var(--radius)",
      },
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        heading: ["var(--font-heading)", "var(--font-body)", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;

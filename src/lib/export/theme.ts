/*
 * unslop-ignore
 *
 * The v1 ELVT client theme: cream page, gold accent. On paper that is two
 * thirds of DESIGN.md hard fail 0, the "cream plus serif plus sage" tasteful
 * default. It is exempt because it is a real brand decision driven by a
 * supplied wordmark and already shipped to eight live clients, not a model
 * default, and DESIGN.md Part 1 tell 0 records that exemption by name.
 *
 * The exemption covers the client apps only. The portal must never inherit it,
 * because inheriting it is exactly how a chosen brand slides into the default
 * look. Nothing under src/app or src/components imports this, and a test says
 * so.
 *
 * It lives here rather than inline in the generator because it was in two
 * places, and the second copy is what the design audit caught. The CSS file at
 * src/styles/client-export-theme.css is the portal side record of the same
 * decision, and a test asserts the two agree so they cannot drift.
 */

export const CLIENT_TOKENS = {
  "--bg": "#FAF7F2",
  "--panel": "#FFFFFF",
  "--panel2": "#F4F0E9",
  "--line": "#E4DFD6",
  "--txt": "#111111",
  "--mut": "#6E6A64",
  "--gold": "#8A6F34",
  "--radius": "12px",
} as const;

export function tokenBlock(): string {
  const lines = Object.entries(CLIENT_TOKENS)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join("\n");
  return `:root {\n${lines}\n}`;
}

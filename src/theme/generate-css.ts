// tokens → CSS custom properties. Rendered inline by the root layout (no build step).
// Every variable is prefixed --hz-; globals.css maps Tailwind's @theme onto these.
import { tokens } from "./tokens";
import { fontAliases } from "./fonts";

const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

function themeColorVars(mode: "light" | "dark"): string[] {
  return Object.entries(tokens.color[mode]).map(([k, v]) => `--hz-color-${kebab(k)}: ${v};`);
}

function sharedVars(): string[] {
  const out: string[] = [];
  const groups = {
    risk: tokens.color.risk, hazard: tokens.color.hazard, prov: tokens.color.provenance, chart: tokens.color.chart,
    quality: tokens.color.quality, series: tokens.color.series, delta: tokens.color.delta,
  };
  for (const [g, vals] of Object.entries(groups)) for (const [k, v] of Object.entries(vals)) out.push(`--hz-color-${g}-${kebab(k)}: ${v};`);
  for (const [k, v] of Object.entries(fontAliases)) out.push(`${k}: ${v};`);
  out.push(`--hz-font-display: ${tokens.font.display};`, `--hz-font-sans: ${tokens.font.sans};`, `--hz-font-mono: ${tokens.font.mono};`, `--hz-font-serif: ${tokens.font.serif};`);
  out.push(`--hz-font-numeric: ${tokens.font.numericFeatures};`);
  for (const [k, v] of Object.entries(tokens.weight)) out.push(`--hz-font-weight-${k}: ${v};`);
  for (const [k, t] of Object.entries(tokens.type)) {
    out.push(`--hz-text-${k}: ${t.size};`, `--hz-leading-${k}: ${t.line};`, `--hz-tracking-${k}: ${t.tracking};`);
  }
  for (const [k, v] of Object.entries(tokens.space)) out.push(`--hz-space-${k}: ${v};`);
  for (const [k, v] of Object.entries(tokens.radius)) out.push(`--hz-radius-${k}: ${v};`);
  for (const [k, v] of Object.entries(tokens.shadow)) out.push(`--hz-shadow-${k}: ${v};`);
  out.push(`--hz-motion-fast: ${tokens.motion.fast};`, `--hz-motion-base: ${tokens.motion.base};`, `--hz-motion-slow: ${tokens.motion.slow};`, `--hz-ease: ${tokens.motion.ease};`);
  for (const [k, v] of Object.entries(tokens.layout)) out.push(`--hz-layout-${kebab(k)}: ${v};`);
  return out;
}

export function tokensToCss(): string {
  return [
    `:root{${[...sharedVars(), ...themeColorVars("light")].join("")}}`,
    `[data-theme="dark"]{${themeColorVars("dark").join("")}}`,
  ].join("\n");
}

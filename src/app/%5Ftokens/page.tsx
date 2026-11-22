// Token showcase at /_tokens (folder is URL-encoded so the App Router doesn't treat it as private).
// Dev only: 404s in production.
import { notFound } from "next/navigation";
import { tokens } from "@/theme/tokens";

export const dynamic = "force-dynamic";

function Swatch({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="h-8 rounded-sm border hairline" style={{ background: value }} />
      <span className="font-mono text-micro text-ink2">{name}</span>
      <span className="font-mono text-micro text-muted">{value}</span>
    </div>
  );
}

function Group({ title, colors }: { title: string; colors: Record<string, string> }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-micro uppercase text-muted">{title}</h2>
      <div className="grid grid-cols-6 gap-4">
        {Object.entries(colors).map(([k, v]) => <Swatch key={k} name={k} value={v} />)}
      </div>
    </section>
  );
}

export default function TokensPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const c = tokens.color;
  return (
    <div className="flex flex-col gap-7">
      <h1 className="font-display text-h1">Tokens</h1>
      <Group title="Light" colors={c.light} />
      <Group title="Dark" colors={c.dark} />
      <Group title="Risk" colors={c.risk} />
      <Group title="Hazard" colors={c.hazard} />
      <Group title="Provenance" colors={c.provenance} />
      <Group title="Chart" colors={c.chart} />

      <section className="flex flex-col gap-3">
        <h2 className="text-micro uppercase text-muted">Type</h2>
        <p className="font-display text-hero">Hero ₹1,234.5 cr</p>
        <p className="font-display text-h1">H1 display heading</p>
        <p className="text-h2 font-medium">H2 heading</p>
        <p className="text-h3 font-medium">H3 heading</p>
        <p className="text-body">Body copy: climate hazards put revenue at risk each year.</p>
        <p className="text-small text-ink2">Small: secondary detail text.</p>
        <p className="text-micro uppercase text-muted">Micro label</p>
        <p className="tabular font-display text-figure">₹48,210.7 cr</p>
        <p className="font-mono text-small">aqueduct40 · asm.flood_downtime_days</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-micro uppercase text-muted">Space · radius · shadow</h2>
        <div className="flex items-end gap-2">
          {Object.keys(tokens.space).map((k) => (
            <div key={k} className="flex flex-col items-center gap-1">
              <div className="bg-accent" style={{ width: `var(--hz-space-${k})`, height: `var(--hz-space-${k})` }} />
              <span className="font-mono text-micro text-muted">{k}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-5">
          <div className="h-8 w-8 rounded-sm bg-surface shadow-card" />
          <div className="h-8 w-8 rounded-md bg-surface shadow-card" />
          <div className="h-8 w-8 rounded-lg bg-surface shadow-lift" />
          <div className="h-8 w-9 rounded-pill bg-accent-soft" />
        </div>
      </section>
    </div>
  );
}

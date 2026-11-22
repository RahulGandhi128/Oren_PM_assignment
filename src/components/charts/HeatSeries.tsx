"use client";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTokens } from "@/theme/useTokens";
import type { components } from "@/lib/api-types";

type Point = components["schemas"]["SeriesPoint"];

/** Days ≥ 40 °C per year: ensemble median line, model min–max band, Today and 2040 windows shaded. */
export function HeatSeries({ data, windows }: { data: Point[]; windows: Record<string, number[]> }) {
  const t = useTokens();
  const rows = data.map((d) => ({ year: d.year, median: d.value, band: [d.min, d.max] as [number, number] }));
  const axis = { fontSize: 11, fill: t.chart.axis };
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={rows} margin={{ top: 16, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid stroke={t.chart.grid} vertical={false} />
        {Object.entries(windows).map(([k, [a, b]]) => (
          <ReferenceArea key={k} x1={a} x2={b} fill={k === "2040" ? t.chart.future : t.chart.today} fillOpacity={0.08}
            label={{ value: k === "2040" ? `2040 (${a}–${b})` : `Today (${a}–${b})`, position: "insideTop", fontSize: 11, fill: t.ui.ink2 }} />
        ))}
        <XAxis dataKey="year" type="number" domain={["dataMin", "dataMax"]} tick={axis} tickLine={false} axisLine={{ stroke: t.chart.grid }}
          ticks={[1980, 1990, 2000, 2010, 2020, 2030, 2040, 2050]} />
        <YAxis tick={axis} tickLine={false} axisLine={false} width={48} />
        <Tooltip
          contentStyle={{ background: t.ui.surface, border: `1px solid ${t.ui.border}`, borderRadius: t.radius.sm, fontSize: 12 }}
          formatter={(v, name) => (name === "band" && Array.isArray(v) ? [`${v[0]}–${v[1]} days`, "Model range"] : [`${v} days`, "Median of models"])}
          labelFormatter={(y) => `${y}`}
        />
        <Area dataKey="band" stroke="none" fill={t.chart.today} fillOpacity={0.25} isAnimationActive={false} />
        <Line dataKey="median" stroke={t.chart.future} strokeWidth={2} dot={false} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

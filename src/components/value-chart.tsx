"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { cn } from "@/lib/cn";

export interface ValuePoint {
  slug: string;
  name: string;
  lab: string;
  price: number;
  score: number;
  openWeights: boolean;
  onFrontier: boolean;
}

/**
 * SVG presentation attributes (fill="…") can't read CSS variables, so resolve
 * the theme tokens to real colors. useSyncExternalStore subscribes to the
 * light/dark media query, so colors update if the OS theme flips.
 */
const FALLBACK_COLORS = "#6366f1|#888888|#333333";

function readThemeColors() {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string) => s.getPropertyValue(name).trim();
  return [v("--accent"), v("--muted"), v("--border")].join("|"); // string = stable snapshot
}

function subscribeTheme(onChange: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function useThemeColors() {
  const snapshot = useSyncExternalStore(subscribeTheme, readThemeColors, () => FALLBACK_COLORS);
  const [accent, muted, border] = snapshot.split("|");
  return { accent, muted, border };
}

/**
 * Intelligence vs blended price (log scale). The Pareto frontier — models no
 * other model beats on both axes — is drawn as a line. Click a dot to open it.
 */
export function ValueChart({ points }: { points: ValuePoint[] }) {
  const router = useRouter();
  const [openOnly, setOpenOnly] = useState(false);
  const c = useThemeColors();

  const visible = useMemo(() => points.filter((p) => !openOnly || p.openWeights), [points, openOnly]);
  const frontier = useMemo(() => visible.filter((p) => p.onFrontier).sort((a, b) => a.price - b.price), [visible]);
  const others = useMemo(() => visible.filter((p) => !p.onFrontier), [visible]);

  const onClick = (data: unknown) => {
    const slug = (data as { payload?: ValuePoint })?.payload?.slug;
    if (slug) router.push(`/models/${slug}`);
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-accent" /> Pareto frontier (best value)</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-muted/50" /> Other models</span>
        <label className="ml-auto flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} className="accent-[var(--accent)]" />
          Open weights only
        </label>
      </div>
      <div className="h-[380px] w-full">
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 0 }}>
            <CartesianGrid stroke={c.border} strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="price"
              scale="log"
              ticks={[0.03, 0.1, 0.3, 1, 3, 10, 30, 100]}
              domain={["auto", "auto"]}
              tickFormatter={(v: number) => `$${v < 1 ? v.toFixed(2) : Math.round(v)}`}
              stroke={c.muted}
              fontSize={11}
              label={{ value: "Blended price per 1M tokens (3:1 input:output, log scale)", position: "bottom", offset: 10, fill: c.muted, fontSize: 11 }}
            />
            <YAxis
              type="number"
              dataKey="score"
              domain={["auto", "auto"]}
              stroke={c.muted}
              fontSize={11}
              width={40}
              label={{ value: "Intelligence", angle: -90, position: "insideLeft", fill: c.muted, fontSize: 11 }}
            />
            <ZAxis range={[50, 50]} />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<ChartTooltip />} />
            <Scatter data={others} fill={c.muted} fillOpacity={0.45} onClick={onClick} className="cursor-pointer" isAnimationActive={false} />
            <Scatter
              data={frontier}
              fill={c.accent}
              line={{ stroke: c.accent, strokeWidth: 1.5 }}
              onClick={onClick}
              className="cursor-pointer"
              isAnimationActive={false}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: ValuePoint }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-xs shadow-lg">
      <div className="font-medium">{p.name}</div>
      <div className="text-muted">{p.lab}</div>
      <div className="mt-1 grid grid-cols-2 gap-x-3">
        <span className="text-muted">Intelligence</span>
        <span className="tabular text-right">{p.score.toFixed(1)}</span>
        <span className="text-muted">Blended $/1M</span>
        <span className="tabular text-right">${p.price.toFixed(2)}</span>
      </div>
      {p.onFrontier && <div className={cn("mt-1 font-medium text-accent")}>On the value frontier</div>}
    </div>
  );
}

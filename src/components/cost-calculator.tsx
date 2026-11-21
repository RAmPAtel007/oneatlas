"use client";

import { Calculator } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { formatUsd } from "@/lib/format";

/**
 * "What will this actually cost me?" — turns per-token prices into a monthly
 * bill for a concrete workload, including prompt caching. Used on the model
 * page (rows = providers) and the compare page (rows = models).
 */
export interface CostRow {
  key: string;
  label: string;
  sublabel?: string;
  inputPrice: number | null;
  outputPrice: number | null;
  cacheReadPrice?: number | null;
  /** Row to measure savings against (e.g. the lab's official API). */
  isReference?: boolean;
}

const PRESETS = [
  { label: "Chatbot", input: 10, output: 2, cache: 0 },
  { label: "RAG / docs Q&A", input: 50, output: 2, cache: 50 },
  { label: "Coding agent", input: 200, output: 10, cache: 80 },
  { label: "Batch classification", input: 100, output: 1, cache: 0 },
];

export function monthlyCost(row: CostRow, inputM: number, outputM: number, cachePct: number): number | null {
  if (row.inputPrice == null || row.outputPrice == null) return null;
  const cached = inputM * (cachePct / 100);
  const uncached = inputM - cached;
  const cacheRate = row.cacheReadPrice ?? row.inputPrice; // no cache discount → full price
  return uncached * row.inputPrice + cached * cacheRate + outputM * row.outputPrice;
}

export function CostCalculator({ rows, title = "Cost calculator", limit = 8 }: { rows: CostRow[]; title?: string; limit?: number }) {
  const [inputM, setInputM] = useState(10);
  const [outputM, setOutputM] = useState(2);
  const [cachePct, setCachePct] = useState(0);
  const [showAll, setShowAll] = useState(false);

  const results = useMemo(() => {
    return rows
      .map((r) => ({ ...r, cost: monthlyCost(r, inputM, outputM, cachePct) }))
      .filter((r): r is typeof r & { cost: number } => r.cost !== null)
      .sort((a, b) => a.cost - b.cost);
  }, [rows, inputM, outputM, cachePct]);

  const reference = results.find((r) => r.isReference);
  const max = Math.max(...results.map((r) => r.cost), 0.0001);
  const shown = showAll ? results : results.slice(0, limit);

  if (!results.length) return null;

  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <Calculator className="size-4 text-accent" />
        <h2 className="font-semibold">{title}</h2>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {PRESETS.map((p) => {
          const active = p.input === inputM && p.output === outputM && p.cache === cachePct;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                setInputM(p.input);
                setOutputM(p.output);
                setCachePct(p.cache);
              }}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs",
                active ? "border-accent bg-accent-soft text-accent" : "hover:bg-subtle",
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <NumberField label="Input tokens / month" suffix="M" value={inputM} onChange={setInputM} />
        <NumberField label="Output tokens / month" suffix="M" value={outputM} onChange={setOutputM} />
        <label className="text-xs text-muted">
          Prompt cache hit rate: <span className="tabular font-medium text-foreground">{cachePct}%</span>
          <input
            type="range"
            min={0}
            max={95}
            step={5}
            value={cachePct}
            onChange={(e) => setCachePct(Number(e.target.value))}
            className="mt-2 w-full accent-[var(--accent)]"
          />
        </label>
      </div>

      <ul className="space-y-2">
        {shown.map((r, i) => {
          const saving = reference && r.key !== reference.key && reference.cost > 0 ? 1 - r.cost / reference.cost : null;
          return (
            <li key={r.key} className="text-sm">
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate">
                  <span className={cn(i === 0 && "font-medium")}>{r.label}</span>
                  {r.sublabel && <span className="ml-2 text-xs text-muted">{r.sublabel}</span>}
                  {r.isReference && <span className="ml-2 text-xs text-accent">official</span>}
                </span>
                <span className="flex shrink-0 items-baseline gap-2">
                  {saving !== null && Math.abs(saving) >= 0.01 && (
                    <span className={cn("text-xs", saving > 0 ? "text-good" : "text-warn")}>
                      {saving > 0 ? `−${Math.round(saving * 100)}%` : `+${Math.round(-saving * 100)}%`}
                    </span>
                  )}
                  <span className="tabular font-medium">{formatUsd(r.cost)}</span>
                  <span className="text-xs text-muted">/mo</span>
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-subtle">
                <div
                  className={cn("h-full rounded-full", i === 0 ? "bg-good" : "bg-accent/60")}
                  style={{ width: `${Math.max(1, (r.cost / max) * 100)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {results.length > limit && (
        <button type="button" onClick={() => setShowAll((s) => !s)} className="mt-3 text-xs text-accent hover:underline">
          {showAll ? "Show fewer" : `Show all ${results.length}`}
        </button>
      )}
      <p className="mt-4 text-xs text-muted">
        Estimates from listed per-token prices. Excludes subscription plans, bundled $0 listings, taxes and volume discounts.
      </p>
    </div>
  );
}

function NumberField({ label, suffix, value, onChange }: { label: string; suffix: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="text-xs text-muted">
      {label}
      <div className="mt-1 flex items-center rounded-md border bg-background focus-within:border-accent">
        <input
          type="number"
          min={0}
          step="any"
          value={value}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
          className="tabular h-8 w-full bg-transparent px-2 text-sm text-foreground outline-none"
        />
        <span className="pr-2 text-xs">{suffix}</span>
      </div>
    </label>
  );
}

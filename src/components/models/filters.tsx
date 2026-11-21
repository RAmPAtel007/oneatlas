"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { typeLabel } from "@/lib/format";
import {
  CAPABILITY_PARAMS,
  modelsHref,
  type CapabilityParam,
  type ModelListQuery,
  type ModelTypeParam,
} from "@/lib/query-schemas";
import type { FilterOptions } from "@/server/services/models";

/**
 * Filter sidebar. The URL is the single source of truth: every change builds
 * a new /models?… URL and the server re-renders results. That makes filtered
 * views shareable, bookmarkable and back-button friendly.
 */

const CAPABILITY_LABELS: Record<CapabilityParam, string> = {
  reasoning: "Reasoning",
  tools: "Tool calling",
  "structured-output": "Structured output (JSON)",
  vision: "Vision input",
  "audio-input": "Audio input",
  "open-weights": "Open weights",
  free: "Free tier available",
};

const CONTEXT_OPTIONS = [
  { label: "Any", value: undefined },
  { label: "32K+", value: 32_000 },
  { label: "128K+", value: 128_000 },
  { label: "200K+", value: 200_000 },
  { label: "1M+", value: 1_000_000 },
];

const PRICE_OPTIONS = [
  { label: "Any", value: undefined },
  { label: "≤ $0.25", value: 0.25 },
  { label: "≤ $1", value: 1 },
  { label: "≤ $3", value: 3 },
  { label: "≤ $10", value: 10 },
];

export function ModelFilters({ query, options, view }: { query: ModelListQuery; options: FilterOptions; view?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState(query.q ?? "");
  const [mobileOpen, setMobileOpen] = useState(false);

  const navigate = (overrides: Partial<ModelListQuery>) => {
    startTransition(() => {
      router.replace(modelsHref(query, { ...overrides, page: 1, view }), { scroll: false });
    });
  };

  // Debounce free-text search so we don't navigate on every keystroke.
  useEffect(() => {
    if ((query.q ?? "") === text.trim()) return;
    const t = setTimeout(() => navigate({ q: text.trim() || undefined }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const toggleIn = <T extends string>(list: T[] | undefined, value: T) => {
    const set = new Set(list ?? []);
    if (set.has(value)) set.delete(value);
    else set.add(value);
    return set.size ? [...set] : undefined;
  };

  const activeCount =
    (query.lab?.length ?? 0) +
    (query.provider?.length ?? 0) +
    (query.type?.length ?? 0) +
    (query.cap?.length ?? 0) +
    (query.minContext ? 1 : 0) +
    (query.maxPrice !== undefined ? 1 : 0) +
    (query.deprecated ? 1 : 0);

  return (
    <aside className={cn("transition-opacity", pending && "opacity-60")}>
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Filter by name…"
          aria-label="Filter models by name"
          className="h-9 w-full rounded-lg border bg-card pr-3 pl-9 text-sm outline-none focus:border-accent"
        />
      </div>

      <button
        type="button"
        onClick={() => setMobileOpen((o) => !o)}
        className="mb-4 flex w-full items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm lg:hidden"
        aria-expanded={mobileOpen}
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal className="size-4" /> Filters {activeCount > 0 && `(${activeCount})`}
        </span>
        <span className="text-muted">{mobileOpen ? "Hide" : "Show"}</span>
      </button>

      <div className={cn("space-y-6", !mobileOpen && "hidden lg:block")}>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={() => {
              setText("");
              startTransition(() => router.replace(modelsHref({}, { sort: query.sort, view }), { scroll: false }));
            }}
            className="flex items-center gap-1 text-xs text-accent hover:underline"
          >
            <X className="size-3" /> Clear {activeCount} filter{activeCount > 1 ? "s" : ""}
          </button>
        )}

        <FilterGroup title="Type">
          <div className="flex flex-wrap gap-1.5">
            {options.types.map(({ type, count }) => {
              const value = type.toLowerCase() as ModelTypeParam;
              const active = query.type?.includes(value);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => navigate({ type: toggleIn(query.type, value) })}
                  aria-pressed={active}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs",
                    active ? "border-accent bg-accent-soft text-accent" : "bg-card hover:bg-subtle",
                  )}
                >
                  {typeLabel(type)} <span className="text-muted">{count}</span>
                </button>
              );
            })}
          </div>
        </FilterGroup>

        <FilterGroup title="Capabilities">
          {CAPABILITY_PARAMS.map((cap) => (
            <Checkbox
              key={cap}
              label={CAPABILITY_LABELS[cap]}
              checked={query.cap?.includes(cap) ?? false}
              onChange={() => navigate({ cap: toggleIn(query.cap, cap) })}
            />
          ))}
        </FilterGroup>

        <FilterGroup title="Context window">
          <Segmented
            options={CONTEXT_OPTIONS}
            value={query.minContext}
            onChange={(v) => navigate({ minContext: v })}
          />
        </FilterGroup>

        <FilterGroup title="Max input price / 1M tokens">
          <Segmented options={PRICE_OPTIONS} value={query.maxPrice} onChange={(v) => navigate({ maxPrice: v })} />
        </FilterGroup>

        <SearchableList
          title="Lab"
          items={options.labs}
          selected={query.lab}
          onToggle={(slug) => navigate({ lab: toggleIn(query.lab, slug) })}
        />

        <SearchableList
          title="Provider"
          items={options.providers}
          selected={query.provider}
          onToggle={(slug) => navigate({ provider: toggleIn(query.provider, slug) })}
        />

        <FilterGroup title="Status">
          <Checkbox
            label="Include deprecated models"
            checked={query.deprecated}
            onChange={() => navigate({ deprecated: !query.deprecated })}
          />
        </FilterGroup>
      </div>
    </aside>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">{title}</legend>
      <div className="space-y-1.5">{children}</div>
    </fieldset>
  );
}

function Checkbox({ label, checked, onChange, count }: { label: string; checked: boolean; onChange: () => void; count?: number }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={onChange} className="size-4 accent-[var(--accent)]" />
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && <span className="tabular text-xs text-muted">{count}</span>}
    </label>
  );
}

function Segmented<T extends number | undefined>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            "rounded-md border px-2 py-1 text-xs",
            value === o.value ? "border-accent bg-accent-soft text-accent" : "bg-card hover:bg-subtle",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SearchableList({
  title,
  items,
  selected,
  onToggle,
}: {
  title: string;
  items: { slug: string; name: string; count: number }[];
  selected?: string[];
  onToggle: (slug: string) => void;
}) {
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState(false);
  const visible = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const matches = f ? items.filter((i) => i.name.toLowerCase().includes(f)) : items;
    // Always keep selected items visible at the top.
    const sel = new Set(selected ?? []);
    const ordered = [...matches.filter((i) => sel.has(i.slug)), ...matches.filter((i) => !sel.has(i.slug))];
    return expanded || f ? ordered : ordered.slice(0, 8);
  }, [items, filter, expanded, selected]);

  return (
    <FilterGroup title={title}>
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder={`Find ${title.toLowerCase()}…`}
        aria-label={`Find ${title.toLowerCase()}`}
        className="mb-1 h-8 w-full rounded-md border bg-card px-2 text-xs outline-none focus:border-accent"
      />
      <div className={cn("space-y-1.5", (expanded || filter) && "max-h-64 overflow-y-auto pr-1")}>
        {visible.map((i) => (
          <Checkbox key={i.slug} label={i.name} count={i.count} checked={selected?.includes(i.slug) ?? false} onChange={() => onToggle(i.slug)} />
        ))}
      </div>
      {!filter && items.length > 8 && (
        <button type="button" onClick={() => setExpanded((e) => !e)} className="text-xs text-accent hover:underline">
          {expanded ? "Show fewer" : `Show all ${items.length}`}
        </button>
      )}
    </FilterGroup>
  );
}

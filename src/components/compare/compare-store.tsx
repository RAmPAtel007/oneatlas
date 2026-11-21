"use client";

import { GitCompareArrows, Plus, X, Check } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { compareHref, MAX_COMPARE } from "@/lib/compare";

/**
 * Compare selection, persisted in localStorage so it survives navigation and
 * reloads. A tiny external store + useSyncExternalStore means every button
 * and the tray stay in sync without a React context provider.
 */
export interface CompareItem {
  slug: string;
  name: string;
}

const KEY = "oneatlas:compare";
const listeners = new Set<() => void>();
let cache: CompareItem[] | null = null;
const EMPTY: CompareItem[] = [];

function read(): CompareItem[] {
  if (cache) return cache;
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    cache = Array.isArray(parsed) ? parsed.filter((i) => i && typeof i.slug === "string").slice(0, MAX_COMPARE) : [];
  } catch {
    cache = [];
  }
  return cache!;
}

function write(items: CompareItem[]) {
  cache = items;
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* storage unavailable (private mode) — keep in memory only */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useCompare() {
  const items = useSyncExternalStore(subscribe, read, () => EMPTY);
  return {
    items,
    has: (slug: string) => items.some((i) => i.slug === slug),
    toggle: (item: CompareItem) => {
      const current = read();
      if (current.some((i) => i.slug === item.slug)) write(current.filter((i) => i.slug !== item.slug));
      else if (current.length < MAX_COMPARE) write([...current, item]);
    },
    remove: (slug: string) => write(read().filter((i) => i.slug !== slug)),
    clear: () => write([]),
  };
}

export function CompareButton({ slug, name, variant = "icon" }: CompareItem & { variant?: "icon" | "full" }) {
  const { has, toggle, items } = useCompare();
  const selected = has(slug);
  const full = !selected && items.length >= MAX_COMPARE;
  const label = selected ? "Remove from compare" : full ? `Compare is full (max ${MAX_COMPARE})` : "Add to compare";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle({ slug, name });
      }}
      disabled={full}
      title={label}
      aria-label={label}
      aria-pressed={selected}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md border text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        variant === "icon" ? "size-7" : "h-9 px-3 text-sm",
        selected ? "border-accent bg-accent-soft text-accent" : "bg-card hover:bg-subtle",
      )}
    >
      {selected ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
      {variant === "full" && (selected ? "In compare" : "Compare")}
    </button>
  );
}

/** Floating bar shown whenever at least one model is selected. */
export function CompareTray() {
  const { items, remove, clear } = useCompare();
  const pathname = usePathname();
  // Redundant on the compare page itself, where it would cover the table.
  if (!items.length || pathname === "/compare") return null;
  return (
    <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div className="flex max-w-full items-center gap-2 overflow-x-auto rounded-xl border bg-card p-2 shadow-lg">
        <GitCompareArrows className="ml-1 size-4 shrink-0 text-accent" />
        {items.map((i) => (
          <span key={i.slug} className="flex shrink-0 items-center gap-1 rounded-md bg-subtle py-1 pr-1 pl-2 text-xs">
            {i.name}
            <button type="button" onClick={() => remove(i.slug)} aria-label={`Remove ${i.name}`} className="rounded p-0.5 hover:bg-border">
              <X className="size-3" />
            </button>
          </span>
        ))}
        <button type="button" onClick={clear} className="shrink-0 px-2 text-xs text-muted hover:text-foreground">
          Clear
        </button>
        <Link
          href={compareHref(items.map((i) => i.slug))}
          className={cn(
            "shrink-0 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg",
            items.length < 2 && "pointer-events-none opacity-50",
          )}
          aria-disabled={items.length < 2}
        >
          Compare {items.length}
        </Link>
      </div>
    </div>
  );
}

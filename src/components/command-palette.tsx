"use client";

import { Boxes, Building2, Cpu, Search, Server } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";

interface SearchResults {
  models: { slug: string; name: string; lab: string; type: string }[];
  labs: { slug: string; name: string }[];
  providers: { slug: string; name: string }[];
}

interface Item {
  key: string;
  group: string;
  label: string;
  hint?: string;
  href: string;
  icon: "model" | "lab" | "provider" | "search";
}

const ICONS = { model: Cpu, lab: Building2, provider: Server, search: Search };

/**
 * ⌘K / Ctrl+K global search. Talks to GET /api/v1/search (debounced,
 * stale responses discarded) and supports full keyboard navigation.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "/" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  // Fetch results for the current query. Loading is set in the input's
  // onChange (an event handler), so this effect only syncs with the network.
  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/search?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        if (id === requestId.current) {
          setResults(res.ok ? json.data : null);
          setActive(0);
        }
      } catch {
        if (id === requestId.current) setResults(null);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [query]);

  const items = useMemo<Item[]>(() => {
    const q = query.trim();
    if (!q) return [];
    const list: Item[] = [];
    for (const m of results?.models ?? []) {
      list.push({ key: `m:${m.slug}`, group: "Models", label: m.name, hint: m.lab, href: `/models/${m.slug}`, icon: "model" });
    }
    for (const l of results?.labs ?? []) {
      list.push({ key: `l:${l.slug}`, group: "Labs", label: l.name, href: `/labs/${l.slug}`, icon: "lab" });
    }
    for (const p of results?.providers ?? []) {
      list.push({ key: `p:${p.slug}`, group: "Providers", label: p.name, href: `/providers/${p.slug}`, icon: "provider" });
    }
    list.push({ key: "all", group: "Search", label: `Search all models for “${q}”`, href: `/models?q=${encodeURIComponent(q)}`, icon: "search" });
    return list;
  }, [results, query]);

  const activeIndex = Math.min(active, Math.max(0, items.length - 1));
  const showLoading = loading && query.trim().length > 0;

  const go = useCallback(
    (item: Item | undefined) => {
      if (!item) return;
      setOpen(false);
      setQuery("");
      router.push(item.href);
    },
    [router],
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full items-center gap-2 rounded-lg border bg-card px-3 text-sm text-muted transition-colors hover:bg-subtle sm:w-64"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Search models, labs…</span>
        <kbd className="hidden rounded border bg-subtle px-1.5 font-mono text-[10px] sm:inline">Ctrl K</kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-sm"
          onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div role="dialog" aria-modal="true" aria-label="Search" className="w-full max-w-xl overflow-hidden rounded-xl border bg-card shadow-2xl">
            <div className="flex items-center gap-2 border-b px-3">
              <Search className="size-4 text-muted" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setLoading(e.target.value.trim().length > 0);
                  if (!e.target.value.trim()) setResults(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActive((a) => Math.min(a + 1, items.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((a) => Math.max(a - 1, 0));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    go(items[activeIndex]);
                  } else if (e.key === "Escape") {
                    setOpen(false);
                  }
                }}
                placeholder="Search models, labs, providers… (typos are OK)"
                className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
                role="combobox"
                aria-expanded={items.length > 0}
                aria-controls="palette-results"
                aria-activedescendant={items[activeIndex]?.key}
              />
              {showLoading && <span className="text-xs text-muted">Searching…</span>}
            </div>

            <ul id="palette-results" role="listbox" className="max-h-[50vh] overflow-y-auto p-1">
              {!query.trim() && (
                <li className="px-3 py-6 text-center text-sm text-muted">
                  Try “claude”, “llama”, “groq” or even “gemni”.
                </li>
              )}
              {items.map((item, i) => {
                const Icon = ICONS[item.icon];
                const showGroup = i === 0 || items[i - 1].group !== item.group;
                return (
                  <li key={item.key} role="presentation">
                    {showGroup && <div className="px-3 pt-2 pb-1 text-[11px] font-medium tracking-wide text-muted uppercase">{item.group}</div>}
                    <div
                      id={item.key}
                      role="option"
                      aria-selected={i === activeIndex}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(item)}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm",
                        i === activeIndex && "bg-accent-soft text-accent",
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.hint && <span className="truncate text-xs text-muted">{item.hint}</span>}
                    </div>
                  </li>
                );
              })}
              {query.trim() && !showLoading && results && items.length === 1 && (
                <li className="flex items-center gap-2 px-3 py-2 text-xs text-muted">
                  <Boxes className="size-3.5" /> No direct matches.
                </li>
              )}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

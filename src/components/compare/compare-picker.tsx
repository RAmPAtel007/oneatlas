"use client";

import { Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { compareHref, MAX_COMPARE } from "@/lib/compare";
import { useCompare } from "./compare-store";

interface Hit {
  slug: string;
  name: string;
  lab: string;
}

/** Search box that adds a model to the comparison (URL is the source of truth). */
export function ComparePicker({ current }: { current: string[] }) {
  const router = useRouter();
  const { toggle, has } = useCompare();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (!term) return;
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/search?q=${encodeURIComponent(term)}&limit=8`);
        const json = await res.json();
        if (id === reqId.current && res.ok) setHits(json.data.models);
      } catch {
        /* network error — keep previous hits */
      }
    }, 150);
    return () => clearTimeout(t);
  }, [q]);

  // Derived, not stored: an empty box simply shows no hits.
  const shownHits = q.trim() ? hits : [];

  if (current.length >= MAX_COMPARE) {
    return <p className="text-sm text-muted">Comparing the maximum of {MAX_COMPARE} models. Remove one to add another.</p>;
  }

  const add = (hit: Hit) => {
    if (!has(hit.slug)) toggle({ slug: hit.slug, name: hit.name });
    setQ("");
    setOpen(false);
    router.push(compareHref([...current.filter((s) => s !== hit.slug), hit.slug]));
  };

  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted" />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && shownHits[0]) add(shownHits[0]);
        }}
        placeholder="Add a model to compare…"
        aria-label="Add a model to compare"
        className="h-9 w-full rounded-lg border bg-card pr-3 pl-9 text-sm outline-none focus:border-accent"
      />
      {open && shownHits.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border bg-card shadow-lg">
          {shownHits
            .filter((h) => !current.includes(h.slug))
            .map((h) => (
              <li key={h.slug}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => add(h)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-subtle"
                >
                  <Plus className="size-3.5 text-accent" />
                  <span className="flex-1 truncate">{h.name}</span>
                  <span className="text-xs text-muted">{h.lab}</span>
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";
import { Badge, Card } from "./ui";

interface Provider {
  slug: string;
  name: string;
  isSubscription: boolean;
  hasFreeTier: boolean;
  models: number;
  labs: number;
  minInput: number | null;
}

type Kind = "all" | "payg" | "free" | "subscription";

/**
 * ~300 providers is small enough to filter instantly in the browser — the
 * server sends the list once (cached) and typing never hits the network.
 */
export function ProviderDirectory({ providers }: { providers: Provider[] }) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<Kind>("all");

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return providers.filter((p) => {
      if (term && !p.name.toLowerCase().includes(term) && !p.slug.includes(term)) return false;
      if (kind === "free") return p.hasFreeTier;
      if (kind === "subscription") return p.isSubscription;
      if (kind === "payg") return !p.isSubscription;
      return true;
    });
  }, [providers, q, kind]);

  const tabs: { key: Kind; label: string }[] = [
    { key: "all", label: "All" },
    { key: "payg", label: "Pay as you go" },
    { key: "free", label: "Free tier" },
    { key: "subscription", label: "Subscription plans" },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search providers…"
            aria-label="Search providers"
            className="h-9 w-full rounded-lg border bg-card pr-3 pl-9 text-sm outline-none focus:border-accent"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setKind(t.key)}
              aria-pressed={kind === t.key}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs",
                kind === t.key ? "border-accent bg-accent-soft text-accent" : "bg-card hover:bg-subtle",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-3 text-sm text-muted">{visible.length} providers</p>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted">
              <th className="px-4 py-2.5 font-medium">Provider</th>
              <th className="px-3 py-2.5 text-right font-medium">Models</th>
              <th className="px-3 py-2.5 text-right font-medium">Labs</th>
              <th className="px-3 py-2.5 text-right font-medium">Cheapest input / 1M</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => (
              <tr key={p.slug} className="border-b last:border-0 hover:bg-subtle/60">
                <td className="px-4 py-2.5">
                  <Link href={`/providers/${p.slug}`} className="flex items-center gap-2 font-medium hover:text-accent">
                    {p.name}
                    {p.hasFreeTier && <Badge tone="good">Free tier</Badge>}
                    {p.isSubscription && <Badge>Subscription</Badge>}
                  </Link>
                </td>
                <td className="tabular px-3 py-2.5 text-right">{p.models}</td>
                <td className="tabular px-3 py-2.5 text-right">{p.labs}</td>
                <td className="tabular px-3 py-2.5 text-right">{formatPrice(p.minInput)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

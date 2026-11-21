import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { LabAvatar } from "@/components/lab-avatar";
import { ModelGrid } from "@/components/model-list";
import { ButtonLink, Card, SectionTitle } from "@/components/ui";
import { formatDate, formatNumber, formatPrice, modelHref } from "@/lib/format";
import { getCatalogStats, getLeaderboard, getRecentModels, getValueLandscape, listLabs } from "@/server/services/catalog";

const QUICK_FILTERS = [
  { label: "Reasoning", href: "/models?cap=reasoning" },
  { label: "Vision", href: "/models?cap=vision" },
  { label: "Open weights", href: "/models?cap=open-weights" },
  { label: "Free tier", href: "/models?cap=free" },
  { label: "1M+ context", href: "/models?minContext=1000000" },
  { label: "Cheapest first", href: "/models?sort=price" },
  { label: "Embeddings", href: "/models?type=embedding" },
];

// Every query here is `'use cache'`, so the whole page is prerendered into the
// static shell and revalidated hourly — no database hit per visitor.
export default async function HomePage() {
  const [stats, recent, top, labs, value] = await Promise.all([
    getCatalogStats(),
    getRecentModels(6),
    getLeaderboard("aa-intelligence", { limit: 5, openWeights: false }),
    listLabs(),
    getValueLandscape(),
  ]);
  const bestValue = value.filter((p) => p.onFrontier).sort((a, b) => b.score - a.score).slice(0, 4);

  return (
    <div className="space-y-14">
      <section className="pt-6 text-center sm:pt-12">
        <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted">
          <Sparkles className="size-3.5 text-accent" /> {formatNumber(stats.models)} models · {stats.labs} labs · {stats.providers} providers
        </div>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Every AI model, compared.</h1>
        <p className="mx-auto mt-4 max-w-xl text-muted">
          Specs, pricing, capabilities, benchmarks and the providers that serve them, synced daily from public sources.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <ButtonLink href="/models" variant="primary">Browse models <ArrowRight className="size-4" /></ButtonLink>
          <ButtonLink href="/rankings">See rankings</ButtonLink>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {QUICK_FILTERS.map((f) => (
            <Link key={f.href} href={f.href} className="rounded-full border bg-card px-3 py-1 text-xs hover:border-accent hover:text-accent">
              {f.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Tool calling", value: stats.coverage.toolCalling },
          { label: "Reasoning", value: stats.coverage.reasoning },
          { label: "Vision input", value: stats.coverage.vision },
          { label: "Open weights", value: stats.coverage.openWeights },
        ].map((c) => (
          <Card key={c.label} className="p-4">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted">{c.label}</span>
              <span className="tabular font-semibold">{c.value}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-subtle">
              <div className="h-full rounded-full bg-accent" style={{ width: `${c.value}%` }} />
            </div>
            <div className="mt-2 text-xs text-muted">of active text models</div>
          </Card>
        ))}
      </section>

      <section>
        <SectionTitle href="/models">Recently released</SectionTitle>
        <ModelGrid models={recent} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <SectionTitle href="/rankings">Most intelligent</SectionTitle>
          <Card className="divide-y">
            {top?.rows.map((r) => (
              <Link key={r.model.slug} href={modelHref(r.model.slug)} className="flex items-center gap-3 px-4 py-3 hover:bg-subtle/60">
                <span className="tabular w-5 text-sm text-muted">{r.rank}</span>
                <LabAvatar slug={r.model.lab.slug} name={r.model.lab.name} size="sm" />
                <span className="flex-1 truncate text-sm font-medium">{r.model.name}</span>
                <span className="tabular text-sm font-semibold">{r.score.toFixed(1)}</span>
              </Link>
            ))}
          </Card>
        </div>
        <div>
          <SectionTitle href="/rankings#value">Best value (Pareto frontier)</SectionTitle>
          <Card className="divide-y">
            {bestValue.map((p) => (
              <Link key={p.slug} href={modelHref(p.slug)} className="flex items-center gap-3 px-4 py-3 hover:bg-subtle/60">
                <LabAvatar slug={p.labSlug} name={p.lab} size="sm" />
                <span className="flex-1 truncate text-sm font-medium">{p.name}</span>
                <span className="text-xs text-muted">{formatPrice(p.price)} blended</span>
                <span className="tabular w-10 text-right text-sm font-semibold">{p.score.toFixed(1)}</span>
              </Link>
            ))}
          </Card>
          <p className="mt-2 text-xs text-muted">No other model is both cheaper and smarter than these.</p>
        </div>
      </section>

      <section>
        <SectionTitle href="/labs">AI labs</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {labs.slice(0, 12).map((lab) => (
            <Link key={lab.slug} href={`/labs/${lab.slug}`} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 hover:border-accent/50">
              <LabAvatar slug={lab.slug} name={lab.name} />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{lab.name}</div>
                <div className="text-xs text-muted">{lab.modelCount} models</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {stats.lastSyncedAt && (
        <p className="text-center text-xs text-muted">Data last synced {formatDate(stats.lastSyncedAt)}</p>
      )}
    </div>
  );
}

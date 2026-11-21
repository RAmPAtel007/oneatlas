import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LabAvatar } from "@/components/lab-avatar";
import { Badge, Card, PageHeader, SectionTitle, Skeleton } from "@/components/ui";
import { ValueChart } from "@/components/value-chart";
import { cn } from "@/lib/cn";
import { formatPrice, formatTokens, modelHref } from "@/lib/format";
import { getLeaderboard, getValueLandscape, listBenchmarks, type BenchmarkSummary } from "@/server/services/catalog";

export const metadata: Metadata = {
  title: "Rankings & benchmarks",
  description: "AI model leaderboards by benchmark and category, plus the price-vs-intelligence value frontier.",
};

export default function RankingsPage(props: PageProps<"/rankings">) {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Rankings & benchmarks"
        description="Leaderboards from Artificial Analysis (composite indices, 0–100) and Design Arena (human-preference Elo). Pick a benchmark on the left."
      />
      <section id="value">
        <SectionTitle>Price vs. intelligence</SectionTitle>
        <Card className="p-4 sm:p-5">
          <Suspense fallback={<Skeleton className="h-[420px]" />}>
            <ValueSection />
          </Suspense>
        </Card>
      </section>
      <Suspense fallback={<Skeleton className="h-[600px]" />}>
        <Leaderboard searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function ValueSection() {
  const points = await getValueLandscape();
  return <ValueChart points={points} />;
}

async function Leaderboard({ searchParams }: Pick<PageProps<"/rankings">, "searchParams">) {
  const params = await searchParams;
  const slug = typeof params.benchmark === "string" ? params.benchmark : "aa-intelligence";
  const openWeights = params.open === "true";
  const [benchmarks, board] = await Promise.all([
    listBenchmarks(),
    getLeaderboard(slug, { limit: 100, openWeights }),
  ]);
  if (!board) notFound();
  const { benchmark, rows } = board;
  const isElo = benchmark.unit === "elo";
  const max = rows[0]?.score ?? 1;
  const min = isElo ? Math.min(...rows.map((r) => r.score)) - 50 : 0;

  const href = (b: string, open = openWeights) => `/rankings?benchmark=${b}${open ? "&open=true" : ""}`;

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <BenchmarkNav benchmarks={benchmarks} active={benchmark.slug} href={href} />
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{benchmark.name}</h2>
            <p className="max-w-2xl text-sm text-muted">
              {benchmark.description}{" "}
              {benchmark.sourceUrl && (
                <a href={benchmark.sourceUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                  Source: {benchmark.source}
                </a>
              )}
            </p>
          </div>
          <div className="flex rounded-md border bg-card p-0.5 text-xs">
            <Link href={href(benchmark.slug, false)} className={cn("rounded px-2.5 py-1", !openWeights ? "bg-subtle font-medium" : "text-muted")}>
              All models
            </Link>
            <Link href={href(benchmark.slug, true)} className={cn("rounded px-2.5 py-1", openWeights ? "bg-subtle font-medium" : "text-muted")}>
              Open weights
            </Link>
          </div>
        </div>

        <Card className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted">
                <th className="w-12 px-4 py-2.5 font-medium">#</th>
                <th className="px-3 py-2.5 font-medium">Model</th>
                <th className="w-[35%] px-3 py-2.5 font-medium">{isElo ? "Elo" : "Score"}</th>
                <th className="px-3 py-2.5 text-right font-medium">Input / 1M</th>
                <th className="px-3 py-2.5 text-right font-medium">Context</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.model.slug} className="border-b last:border-0 hover:bg-subtle/60">
                  <td className="tabular px-4 py-2.5 text-muted">{r.rank}</td>
                  <td className="px-3 py-2.5">
                    <Link href={modelHref(r.model.slug)} className="flex items-center gap-2.5 hover:text-accent">
                      <LabAvatar slug={r.model.lab.slug} name={r.model.lab.name} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{r.model.name}</span>
                        <span className="block truncate text-xs text-muted">{r.model.lab.name}</span>
                      </span>
                      {r.model.openWeights && <Badge tone="good">Open</Badge>}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-subtle">
                        <div
                          className={cn("h-full rounded-full", r.rank <= 3 ? "bg-accent" : "bg-accent/50")}
                          style={{ width: `${Math.max(2, ((r.score - min) / (max - min || 1)) * 100)}%` }}
                        />
                      </div>
                      <span className="tabular w-12 text-right font-medium">{isElo ? Math.round(r.score) : r.score.toFixed(1)}</span>
                    </div>
                  </td>
                  <td className="tabular px-3 py-2.5 text-right">{formatPrice(r.model.inputPrice)}</td>
                  <td className="tabular px-3 py-2.5 text-right">{formatTokens(r.model.contextWindow)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p className="p-6 text-center text-sm text-muted">No scored models for this filter.</p>}
        </Card>
      </div>
    </div>
  );
}

function BenchmarkNav({
  benchmarks,
  active,
  href,
}: {
  benchmarks: BenchmarkSummary[];
  active: string;
  href: (slug: string) => string;
}) {
  const groups = new Map<string, BenchmarkSummary[]>();
  for (const b of benchmarks) groups.set(b.category, [...(groups.get(b.category) ?? []), b]);
  return (
    <nav aria-label="Benchmarks" className="space-y-5">
      {[...groups].map(([category, items]) => (
        <div key={category}>
          <div className="mb-1.5 text-xs font-medium tracking-wide text-muted uppercase">{category}</div>
          <ul className="space-y-0.5">
            {items.map((b) => (
              <li key={b.slug}>
                <Link
                  href={href(b.slug)}
                  aria-current={b.slug === active ? "page" : undefined}
                  className={cn(
                    "flex items-center justify-between rounded-md px-2 py-1.5 text-sm",
                    b.slug === active ? "bg-accent-soft font-medium text-accent" : "hover:bg-subtle",
                  )}
                >
                  <span className="truncate">{b.name}</span>
                  <span className="tabular text-xs text-muted">{b.modelCount}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

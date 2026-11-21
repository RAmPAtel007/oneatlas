import { Check, Minus, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { ComparePicker } from "@/components/compare/compare-picker";
import { CostCalculator } from "@/components/cost-calculator";
import { LabAvatar } from "@/components/lab-avatar";
import { Card, PageHeader, Skeleton } from "@/components/ui";
import { cn } from "@/lib/cn";
import { compareHref } from "@/lib/compare";
import { formatDate, formatPrice, formatTokens, modalityLabel, modelHref, typeLabel } from "@/lib/format";
import { compareQuerySchema, toParamRecord } from "@/lib/query-schemas";
import { getLeaderboard, getValueLandscape } from "@/server/services/catalog";
import { getModelsForCompare, type CompareModel } from "@/server/services/models";

export const metadata: Metadata = {
  title: "Compare models",
  description: "Compare AI models side by side: pricing, context, capabilities, benchmarks and monthly cost.",
};

/** Presets come from live data, so they never point at a stale model. */
async function getSuggestions() {
  const [top, value] = await Promise.all([
    getLeaderboard("aa-intelligence", { limit: 3, openWeights: false }),
    getValueLandscape(),
  ]);
  const frontier = value.filter((p) => p.onFrontier).sort((a, b) => b.score - a.score).slice(1, 4);
  return [
    { label: "Top 3 by intelligence", slugs: top?.rows.map((r) => r.model.slug) ?? [] },
    { label: "Best-value picks", slugs: frontier.map((p) => p.slug) },
  ].filter((s) => s.slugs.length > 1);
}

export default function ComparePage(props: PageProps<"/compare">) {
  return (
    <>
      <PageHeader title="Compare models" description="Up to 4 models side by side. The best value in each row is highlighted." />
      <Suspense fallback={<Skeleton className="h-[480px]" />}>
        <CompareContent searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function CompareContent({ searchParams }: Pick<PageProps<"/compare">, "searchParams">) {
  const parsed = compareQuerySchema.safeParse(toParamRecord(await searchParams));
  const slugs = parsed.success ? [...new Set(parsed.data.models.map((s) => s.toLowerCase()))] : [];
  const models = slugs.length ? await getModelsForCompare(slugs) : [];

  if (!models.length) {
    const suggestions = await getSuggestions();
    return (
      <div className="space-y-6">
        <ComparePicker current={[]} />
        <Card className="p-6">
          <p className="mb-4 text-sm text-muted">
            Search above, or use the <span className="font-medium text-foreground">+</span> button on any model in the catalog. Try a preset:
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <Link key={s.label} href={compareHref(s.slugs)} className="rounded-full border px-3 py-1.5 text-sm hover:border-accent hover:text-accent">
                {s.label}
              </Link>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  const current = models.map((m) => m.slug);
  const benchmarks = collectBenchmarks(models);

  return (
    <div className="space-y-8">
      <ComparePicker current={current} />

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[640px] table-fixed text-sm">
          <colgroup>
            <col className="w-44" />
            {models.map((m) => <col key={m.slug} />)}
          </colgroup>
          <thead>
            <tr className="border-b">
              <th className="p-4" />
              {models.map((m) => (
                <th key={m.slug} className="p-4 text-left align-top font-normal">
                  <div className="flex items-start gap-2">
                    <LabAvatar slug={m.lab.slug} name={m.lab.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <Link href={modelHref(m.slug)} className="block font-semibold hover:text-accent">{m.name}</Link>
                      <div className="text-xs text-muted">{m.lab.name}</div>
                    </div>
                    <Link
                      href={compareHref(current.filter((s) => s !== m.slug))}
                      aria-label={`Remove ${m.name}`}
                      className="rounded p-1 text-muted hover:bg-subtle hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </Link>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <Section title="Overview" span={models.length} />
            <Row label="Type" models={models} render={(m) => typeLabel(m.type)} />
            <Row label="Released" models={models} render={(m) => formatDate(m.releaseDate)} />
            <Row label="Knowledge cutoff" models={models} render={(m) => m.knowledgeCutoff ?? "—"} />
            <Row label="Providers" models={models} value={(m) => m.providerCount} best="max" render={(m) => m.providerCount} />

            <Section title="Pricing (USD / 1M tokens)" span={models.length} />
            <Row label="Input" models={models} value={(m) => m.inputPrice} best="min" render={(m) => formatPrice(m.inputPrice)} />
            <Row label="Output" models={models} value={(m) => m.outputPrice} best="min" render={(m) => formatPrice(m.outputPrice)} />
            <Row label="Cheapest input" models={models} value={(m) => m.minInputPrice} best="min" render={(m) => formatPrice(m.minInputPrice)} />

            <Section title="Limits" span={models.length} />
            <Row label="Context window" models={models} value={(m) => m.contextWindow} best="max" render={(m) => formatTokens(m.contextWindow)} />
            <Row label="Max output" models={models} value={(m) => m.maxOutputTokens} best="max" render={(m) => formatTokens(m.maxOutputTokens)} />

            <Section title="Capabilities" span={models.length} />
            <Row label="Reasoning" models={models} render={(m) => <YesNo on={m.reasoning} />} />
            <Row label="Tool calling" models={models} render={(m) => <YesNo on={m.toolCalling} />} />
            <Row label="Structured output" models={models} render={(m) => <YesNo on={m.structuredOutput} />} />
            <Row label="Open weights" models={models} render={(m) => <YesNo on={m.openWeights} />} />
            <Row label="Input modalities" models={models} render={(m) => m.inputModalities.map(modalityLabel).join(", ") || "—"} />
            <Row label="Output modalities" models={models} render={(m) => m.outputModalities.map(modalityLabel).join(", ") || "—"} />

            {benchmarks.length > 0 && <Section title="Benchmarks" span={models.length} />}
            {benchmarks.map((b) => {
              const score = (m: CompareModel) => m.scores.find((s) => s.benchmark.slug === b.slug)?.score ?? null;
              return (
                <Row
                  key={b.slug}
                  label={b.name}
                  models={models}
                  value={score}
                  best="max"
                  render={(m) => {
                    const s = score(m);
                    return s == null ? <Minus className="size-3.5 text-muted" /> : b.unit === "elo" ? Math.round(s) : s.toFixed(1);
                  }}
                />
              );
            })}
          </tbody>
        </table>
      </Card>

      <CostCalculator
        title="Monthly cost for your workload"
        rows={models.map((m) => ({
          key: m.slug,
          label: m.name,
          sublabel: m.lab.name,
          inputPrice: m.inputPrice,
          outputPrice: m.outputPrice,
        }))}
      />
    </div>
  );
}

function collectBenchmarks(models: CompareModel[]) {
  const map = new Map<string, CompareModel["scores"][number]["benchmark"]>();
  for (const m of models) for (const s of m.scores) map.set(s.benchmark.slug, s.benchmark);
  return [...map.values()].sort((a, b) => a.sortOrder - b.sortOrder);
}

function Section({ title, span }: { title: string; span: number }) {
  return (
    <tr className="bg-subtle/60">
      <th colSpan={span + 1} className="px-4 py-2 text-left text-xs font-medium tracking-wide text-muted uppercase">
        {title}
      </th>
    </tr>
  );
}

function Row({
  label,
  models,
  render,
  value,
  best,
}: {
  label: string;
  models: CompareModel[];
  render: (m: CompareModel) => ReactNode;
  value?: (m: CompareModel) => number | null;
  best?: "min" | "max";
}) {
  // Highlight the winning cell(s) only when there's a real difference.
  let winner: number | null = null;
  if (value && best && models.length > 1) {
    const vals = models.map(value).filter((v): v is number => v != null);
    if (vals.length > 1 && new Set(vals).size > 1) winner = best === "min" ? Math.min(...vals) : Math.max(...vals);
  }
  return (
    <tr className="border-b last:border-0">
      <th className="px-4 py-2.5 text-left font-normal text-muted">{label}</th>
      {models.map((m) => {
        const isBest = winner !== null && value?.(m) === winner;
        return (
          <td key={m.slug} className={cn("tabular px-4 py-2.5", isBest && "font-semibold text-good")}>
            {render(m)}
          </td>
        );
      })}
    </tr>
  );
}

function YesNo({ on }: { on: boolean }) {
  return on ? <Check className="size-4 text-good" aria-label="Yes" /> : <X className="size-4 text-muted/50" aria-label="No" />;
}

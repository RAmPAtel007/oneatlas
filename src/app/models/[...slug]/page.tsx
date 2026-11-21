import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CapabilityBadges } from "@/components/capabilities";
import { CompareButton } from "@/components/compare/compare-store";
import { CopyButton } from "@/components/copy-button";
import { CostCalculator, type CostRow } from "@/components/cost-calculator";
import { LabAvatar } from "@/components/lab-avatar";
import { ModelGrid } from "@/components/model-list";
import { Badge, Card, SectionTitle, Skeleton, Stat } from "@/components/ui";
import {
  formatDate,
  formatPrice,
  formatTokens,
  modalityLabel,
  typeLabel,
} from "@/lib/format";
import { getModelDetail, getRelatedModels, type ModelDetail } from "@/server/services/models";

type Props = PageProps<"/models/[...slug]">;

const toSlug = (parts: string[]) => parts.map(decodeURIComponent).join("/").toLowerCase();

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const model = await getModelDetail(toSlug((await params).slug));
  if (!model) return { title: "Model not found" };
  return {
    title: `${model.name} — pricing, specs & benchmarks`,
    description:
      model.description ??
      `${model.name} by ${model.lab.name}: context window, pricing across ${model.providerCount} providers, capabilities and benchmarks.`,
  };
}

export default function ModelPage({ params }: Props) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      {params.then(({ slug }) => (
        <ModelContent slug={toSlug(slug)} />
      ))}
    </Suspense>
  );
}

async function ModelContent({ slug }: { slug: string }) {
  const [model, related] = await Promise.all([getModelDetail(slug), getRelatedModels(slug)]);
  if (!model) notFound();

  return (
    <div className="space-y-10">
      <Header model={model} />
      <KeyStats model={model} />

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          <ProvidersTable model={model} />
          <Benchmarks model={model} />
        </div>
        <div className="space-y-6">
          <CostCalculator rows={costRows(model)} title="Monthly cost by provider" limit={6} />
          <Card className="p-5">
            <h2 className="mb-3 font-semibold">Capabilities</h2>
            <CapabilityBadges model={model} />
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted">Input</dt>
                <dd>{model.inputModalities.map(modalityLabel).join(", ") || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Output</dt>
                <dd>{model.outputModalities.map(modalityLabel).join(", ") || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Temperature control</dt>
                <dd>{model.temperature ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">File attachments</dt>
                <dd>{model.attachments ? "Yes" : "No"}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>

      {related.cheaperAlternatives.length > 0 && (
        <section>
          <SectionTitle>Cheaper models with similar intelligence</SectionTitle>
          <ModelGrid models={related.cheaperAlternatives} />
        </section>
      )}
      {related.fromLab.length > 0 && (
        <section>
          <SectionTitle href={`/labs/${model.lab.slug}`}>More from {model.lab.name}</SectionTitle>
          <ModelGrid models={related.fromLab} />
        </section>
      )}
    </div>
  );
}

function Header({ model }: { model: ModelDetail }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-4">
        <LabAvatar slug={model.lab.slug} name={model.lab.name} size="lg" />
        <div className="min-w-0">
          <div className="text-sm text-muted">
            <Link href="/models" className="hover:text-foreground">Models</Link> /{" "}
            <Link href={`/labs/${model.lab.slug}`} className="hover:text-foreground">{model.lab.name}</Link>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{model.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge>{typeLabel(model.type)}</Badge>
            {model.status !== "ACTIVE" && <Badge tone="warn">{model.status.toLowerCase()}</Badge>}
            {model.openWeights && <Badge tone="good">Open weights</Badge>}
            {model.isFree && <Badge tone="good">Free tier available</Badge>}
            <span className="flex items-center gap-1 font-mono text-xs text-muted">
              {model.slug} <CopyButton value={model.slug} label="Copy model id" />
            </span>
          </div>
          {model.description && <p className="mt-3 max-w-3xl text-sm text-muted">{model.description}</p>}
        </div>
      </div>
      <div className="shrink-0">
        <CompareButton slug={model.slug} name={model.name} variant="full" />
      </div>
    </div>
  );
}

function KeyStats({ model }: { model: ModelDetail }) {
  const intelligence = model.scores.find((s) => s.benchmark.slug === "aa-intelligence");
  return (
    <Card className="grid grid-cols-2 gap-5 p-5 sm:grid-cols-4 xl:grid-cols-8">
      <Stat label="Context window" value={formatTokens(model.contextWindow)} />
      <Stat label="Max output" value={formatTokens(model.maxOutputTokens)} />
      <Stat
        label="Input / 1M"
        value={formatPrice(model.inputPrice)}
        hint={model.inputPrice != null ? (model.priceIsOfficial ? "official" : "median") : undefined}
      />
      <Stat label="Output / 1M" value={formatPrice(model.outputPrice)} />
      <Stat
        label="Cheapest input"
        value={formatPrice(model.minInputPrice)}
        hint={model.minInputPrice != null && model.inputPrice != null && model.minInputPrice < model.inputPrice ? "via reseller" : undefined}
      />
      <Stat label="Providers" value={model.providerCount} />
      <Stat
        label="Intelligence"
        value={intelligence ? intelligence.score.toFixed(1) : "—"}
        hint={intelligence?.rank ? `#${intelligence.rank} of ${intelligence.total}` : undefined}
      />
      <Stat label="Released" value={formatDate(model.releaseDate)} hint={model.knowledgeCutoff ? `knowledge ${model.knowledgeCutoff}` : undefined} />
    </Card>
  );
}

type Offering = ModelDetail["offerings"][number];

function offeringNote(o: Offering): { label: string; tone: "warn" | "good" | "neutral" } | null {
  if (o.deprecated) return { label: "Deprecated", tone: "warn" };
  if (o.provider.isSubscription) return { label: "Subscription plan", tone: "neutral" };
  if (o.inputPrice === 0 && o.outputPrice === 0) {
    return o.provider.hasFreeTier ? { label: "Free tier", tone: "good" } : { label: "Bundled", tone: "neutral" };
  }
  return null;
}

/** Same "trusted price" rule as the SQL aggregate in the ingestion pipeline. */
function isTrusted(o: Offering) {
  return (
    !o.deprecated &&
    !o.provider.isSubscription &&
    ((o.inputPrice ?? 0) > 0 || (o.outputPrice ?? 0) > 0 || o.provider.hasFreeTier)
  );
}

function costRows(model: ModelDetail): CostRow[] {
  return model.offerings.filter(isTrusted).map((o) => ({
    key: o.id,
    label: o.provider.name,
    inputPrice: o.inputPrice,
    outputPrice: o.outputPrice,
    cacheReadPrice: o.cacheReadPrice,
    isReference: o.provider.slug === model.lab.slug,
  }));
}

function ProvidersTable({ model }: { model: ModelDetail }) {
  // Real pay-as-you-go prices first (already price-sorted by the query),
  // then bundled / subscription / deprecated listings.
  const offerings = [...model.offerings].sort((a, b) => Number(isTrusted(b)) - Number(isTrusted(a)));
  const price = (o: Offering, v: number | null) =>
    v === 0 && !o.provider.hasFreeTier ? "$0" : formatPrice(v);
  return (
    <section>
      <SectionTitle>Available from {model.providerCount} provider{model.providerCount === 1 ? "" : "s"}</SectionTitle>
      <Card className="max-h-[560px] overflow-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b text-left text-xs text-muted">
              <th className="px-4 py-2.5 font-medium">Provider</th>
              <th className="px-3 py-2.5 font-medium">Model ID</th>
              <th className="px-3 py-2.5 text-right font-medium">Input</th>
              <th className="px-3 py-2.5 text-right font-medium">Output</th>
              <th className="px-3 py-2.5 text-right font-medium">Cache read</th>
              <th className="px-3 py-2.5 text-right font-medium">Context</th>
            </tr>
          </thead>
          <tbody>
            {offerings.map((o) => {
              const note = offeringNote(o);
              const official = o.provider.slug === model.lab.slug;
              return (
                <tr key={o.id} className={`border-b last:border-0 ${o.deprecated ? "opacity-60" : ""}`}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Link href={`/providers/${o.provider.slug}`} className="font-medium hover:text-accent">
                        {o.provider.name}
                      </Link>
                      {official && <Badge tone="accent">Official</Badge>}
                      {note && <Badge tone={note.tone}>{note.label}</Badge>}
                      {o.provider.docsUrl && (
                        <a href={o.provider.docsUrl} target="_blank" rel="noreferrer" className="text-muted hover:text-foreground" aria-label={`${o.provider.name} docs`}>
                          <ExternalLink className="size-3" />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="max-w-[220px] px-3 py-2.5">
                    <span className="flex items-center gap-1 font-mono text-xs text-muted">
                      <span className="truncate">{o.providerModelId}</span>
                      <CopyButton value={o.providerModelId} label="Copy provider model id" />
                    </span>
                  </td>
                  <td className="tabular px-3 py-2.5 text-right">{price(o, o.inputPrice)}</td>
                  <td className="tabular px-3 py-2.5 text-right">{price(o, o.outputPrice)}</td>
                  <td className="tabular px-3 py-2.5 text-right text-muted">{price(o, o.cacheReadPrice)}</td>
                  <td className="tabular px-3 py-2.5 text-right">{formatTokens(o.contextWindow)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <p className="mt-2 text-xs text-muted">Prices in USD per 1M tokens.</p>
    </section>
  );
}

function Benchmarks({ model }: { model: ModelDetail }) {
  if (!model.scores.length) {
    return (
      <section>
        <SectionTitle>Benchmarks</SectionTitle>
        <Card className="p-5 text-sm text-muted">No public benchmark scores for this model yet.</Card>
      </section>
    );
  }
  return (
    <section>
      <SectionTitle href="/rankings">Benchmarks</SectionTitle>
      <Card className="divide-y">
        {model.scores.map((s) => {
          const pct = s.benchmark.unit === "elo" ? Math.min(100, Math.max(0, ((s.score - 1000) / 600) * 100)) : Math.min(100, s.score);
          return (
            <Link key={s.id} href={`/rankings?benchmark=${s.benchmark.slug}`} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-subtle/60 sm:grid-cols-[200px_1fr_120px]">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{s.benchmark.name}</div>
                <div className="text-xs text-muted">{s.benchmark.source}</div>
              </div>
              <div className="order-last col-span-2 h-1.5 overflow-hidden rounded-full bg-subtle sm:order-none sm:col-span-1">
                <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
              </div>
              <div className="text-right">
                <div className="tabular text-sm font-semibold">
                  {s.benchmark.unit === "elo" ? Math.round(s.score) : s.score.toFixed(1)}
                  {s.benchmark.unit === "elo" && <span className="ml-1 text-xs font-normal text-muted">Elo</span>}
                </div>
                {s.rank && <div className="text-xs text-muted">#{s.rank} of {s.total}</div>}
              </div>
            </Link>
          );
        })}
      </Card>
    </section>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <Skeleton className="size-12" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-8 w-72" />
        </div>
      </div>
      <Skeleton className="h-24" />
      <Skeleton className="h-96" />
    </div>
  );
}

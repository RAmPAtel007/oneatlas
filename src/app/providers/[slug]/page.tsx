import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CopyButton } from "@/components/copy-button";
import { Badge, Card, SectionTitle, Skeleton, Stat } from "@/components/ui";
import { formatPrice, formatTokens, modelHref, typeLabel } from "@/lib/format";
import { getProvider } from "@/server/services/catalog";

type Props = PageProps<"/providers/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProvider((await params).slug.toLowerCase());
  return p ? { title: `${p.name} — models & pricing`, description: `Every model served by ${p.name}, with per-token prices.` } : { title: "Provider not found" };
}

export default function ProviderPage({ params }: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-[600px]" />}>
      {params.then(({ slug }) => <ProviderContent slug={slug.toLowerCase()} />)}
    </Suspense>
  );
}

async function ProviderContent({ slug }: { slug: string }) {
  const provider = await getProvider(slug);
  if (!provider) notFound();

  const offerings = provider.offerings;
  const labs = new Set(offerings.map((o) => o.model.lab.slug));
  const priced = offerings.filter((o) => (o.inputPrice ?? 0) > 0);
  const cheapest = priced.length ? Math.min(...priced.map((o) => o.inputPrice!)) : null;

  return (
    <div className="space-y-8">
      <div>
        <div className="text-sm text-muted">
          <Link href="/providers" className="hover:text-foreground">Providers</Link>
        </div>
        <h1 className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          {provider.name}
          {provider.hasFreeTier && <Badge tone="good">Free tier</Badge>}
          {provider.isSubscription && <Badge>Subscription plan</Badge>}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted">
          {provider.docsUrl && (
            <a href={provider.docsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
              Documentation <ExternalLink className="size-3" />
            </a>
          )}
          {provider.apiBaseUrl && (
            <span className="inline-flex items-center gap-1 font-mono text-xs">
              {provider.apiBaseUrl} <CopyButton value={provider.apiBaseUrl} label="Copy API base URL" />
            </span>
          )}
          {provider.sdkPackage && <span className="font-mono text-xs">npm: {provider.sdkPackage}</span>}
        </div>
      </div>

      <Card className="grid grid-cols-2 gap-5 p-5 sm:grid-cols-4">
        <Stat label="Models served" value={offerings.length} />
        <Stat label="Labs" value={labs.size} />
        <Stat label="Cheapest input / 1M" value={formatPrice(cheapest)} />
        <Stat label="Free models" value={offerings.filter((o) => o.inputPrice === 0 && o.outputPrice === 0).length} />
      </Card>

      {provider.isSubscription && (
        <p className="rounded-lg border bg-warn-soft px-4 py-3 text-sm text-warn">
          This is a subscription plan: listed $0 per-token prices mean usage is covered by a monthly fee, so these listings are excluded from OneAtlas price rankings.
        </p>
      )}

      <section>
        <SectionTitle>Models</SectionTitle>
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted">
                <th className="px-4 py-2.5 font-medium">Model</th>
                <th className="px-3 py-2.5 font-medium">ID at {provider.name}</th>
                <th className="px-3 py-2.5 text-right font-medium">Input</th>
                <th className="px-3 py-2.5 text-right font-medium">Output</th>
                <th className="px-3 py-2.5 text-right font-medium">Context</th>
                <th className="px-3 py-2.5 text-right font-medium">vs. reference</th>
              </tr>
            </thead>
            <tbody>
              {offerings.map((o) => {
                const ref = o.model.inputPrice;
                const diff = ref && o.inputPrice != null && o.inputPrice > 0 ? o.inputPrice / ref - 1 : null;
                return (
                  <tr key={o.id} className="border-b last:border-0 hover:bg-subtle/60">
                    <td className="px-4 py-2.5">
                      <Link href={modelHref(o.model.slug)} className="font-medium hover:text-accent">{o.model.name}</Link>
                      <div className="flex items-center gap-1.5 text-xs text-muted">
                        {o.model.lab.name}
                        {o.model.type !== "TEXT" && <Badge>{typeLabel(o.model.type)}</Badge>}
                      </div>
                    </td>
                    <td className="max-w-[240px] px-3 py-2.5">
                      <span className="flex items-center gap-1 font-mono text-xs text-muted">
                        <span className="truncate">{o.providerModelId}</span>
                        <CopyButton value={o.providerModelId} label="Copy model id" />
                      </span>
                    </td>
                    <td className="tabular px-3 py-2.5 text-right">{formatPrice(o.inputPrice)}</td>
                    <td className="tabular px-3 py-2.5 text-right">{formatPrice(o.outputPrice)}</td>
                    <td className="tabular px-3 py-2.5 text-right">{formatTokens(o.contextWindow)}</td>
                    <td className="tabular px-3 py-2.5 text-right text-xs">
                      {diff == null || Math.abs(diff) < 0.01 ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <span className={diff < 0 ? "text-good" : "text-warn"}>
                          {diff < 0 ? "−" : "+"}
                          {Math.round(Math.abs(diff) * 100)}%
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
        <p className="mt-2 text-xs text-muted">“vs. reference” compares this provider’s input price with the model’s official (or median) price.</p>
      </section>
    </div>
  );
}

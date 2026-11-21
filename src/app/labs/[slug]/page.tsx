import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LabAvatar } from "@/components/lab-avatar";
import { ModelTable } from "@/components/model-list";
import { Card, SectionTitle, Skeleton, Stat } from "@/components/ui";
import { formatDate, formatNumber } from "@/lib/format";
import { getLab } from "@/server/services/catalog";

type Props = PageProps<"/labs/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lab = await getLab((await params).slug.toLowerCase());
  return lab
    ? { title: `${lab.name} models`, description: `Every ${lab.name} model: specs, pricing, benchmarks and where to run them.` }
    : { title: "Lab not found" };
}

export default function LabPage({ params }: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-[600px]" />}>
      {params.then(({ slug }) => <LabContent slug={slug.toLowerCase()} />)}
    </Suspense>
  );
}

async function LabContent({ slug }: { slug: string }) {
  const lab = await getLab(slug);
  if (!lab) notFound();

  const active = lab.models.filter((m) => m.status !== "DEPRECATED");
  const deprecated = lab.models.filter((m) => m.status === "DEPRECATED");
  const top = Math.max(...active.map((m) => m.intelligenceScore ?? 0));
  const latest = active.find((m) => m.releaseDate)?.releaseDate ?? null;

  return (
    <div className="space-y-8">
      <div className="flex items-start gap-4">
        <LabAvatar slug={lab.slug} name={lab.name} size="lg" />
        <div>
          <div className="text-sm text-muted">
            <Link href="/labs" className="hover:text-foreground">Labs</Link>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{lab.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted">
            {lab.country && <span>{lab.country}</span>}
            {lab.website && (
              <a href={lab.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                {new URL(lab.website).hostname.replace(/^www\./, "")} <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        </div>
      </div>

      <Card className="grid grid-cols-2 gap-5 p-5 sm:grid-cols-4">
        <Stat label="Active models" value={formatNumber(active.length)} />
        <Stat label="Open-weight models" value={active.filter((m) => m.openWeights).length} />
        <Stat label="Best intelligence score" value={top > 0 ? top.toFixed(1) : "—"} />
        <Stat label="Latest release" value={formatDate(latest)} />
      </Card>

      {lab.topProviders.length > 0 && (
        <section>
          <SectionTitle>Where to run {lab.name} models</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {lab.topProviders.map((p) => (
              <Link key={p.slug} href={`/providers/${p.slug}`} className="rounded-full border bg-card px-3 py-1 text-sm hover:border-accent hover:text-accent">
                {p.name} <span className="text-muted">{p.count}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionTitle href={`/models?lab=${lab.slug}`} hrefLabel="Filter in catalog">Models ({active.length})</SectionTitle>
        <ModelTable models={active} showLab={false} />
      </section>

      {deprecated.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm text-muted hover:text-foreground">
            Show {deprecated.length} deprecated model{deprecated.length > 1 ? "s" : ""}
          </summary>
          <div className="mt-3">
            <ModelTable models={deprecated} showLab={false} />
          </div>
        </details>
      )}
    </div>
  );
}

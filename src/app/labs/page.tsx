import type { Metadata } from "next";
import Link from "next/link";
import { LabAvatar } from "@/components/lab-avatar";
import { Card, PageHeader } from "@/components/ui";
import { formatMonth } from "@/lib/format";
import { listLabs } from "@/server/services/catalog";

export const metadata: Metadata = {
  title: "AI labs",
  description: "Browse the companies and research labs building AI models, their releases and open-weight output.",
};

export default async function LabsPage() {
  const labs = await listLabs();
  return (
    <>
      <PageHeader
        title="AI labs"
        description={`${labs.length} companies and research labs, ranked by the number of active models in the catalog.`}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {labs.map((lab) => (
          <Link key={lab.slug} href={`/labs/${lab.slug}`} className="group">
            <Card className="flex h-full flex-col gap-4 p-4 transition-colors group-hover:border-accent/50">
              <div className="flex items-center gap-3">
                <LabAvatar slug={lab.slug} name={lab.name} />
                <div className="min-w-0">
                  <div className="truncate font-medium group-hover:text-accent">{lab.name}</div>
                  <div className="text-xs text-muted">{lab.country ?? "—"}</div>
                </div>
              </div>
              <dl className="mt-auto grid grid-cols-3 gap-2 text-xs">
                <div>
                  <dt className="text-muted">Models</dt>
                  <dd className="tabular font-medium">{lab.modelCount}</dd>
                </div>
                <div>
                  <dt className="text-muted">Open weights</dt>
                  <dd className="tabular font-medium">{lab.openWeightsCount}</dd>
                </div>
                <div>
                  <dt className="text-muted">Latest</dt>
                  <dd className="font-medium">{formatMonth(lab.latestRelease)}</dd>
                </div>
              </dl>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}

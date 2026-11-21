import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { modelHref } from "@/lib/format";
import { globalSearch } from "@/server/services/catalog";
import { ModelGrid, ModelTable } from "@/components/model-list";
import { ModelFilters } from "@/components/models/filters";
import { PendingNavigationProvider, PendingRegion } from "@/components/models/pending";
import { ModelsToolbar } from "@/components/models/toolbar";
import { Pagination } from "@/components/pagination";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui";
import { modelsHref, parseModelListQuery } from "@/lib/query-schemas";
import { getFilterOptions, listModels } from "@/server/services/models";

export const metadata: Metadata = {
  title: "Models",
  description: "Search, filter and sort AI models by lab, provider, capabilities, price and context window.",
};

// The header is static; everything that depends on ?query streams in behind
// Suspense, so the page shell is served instantly from the CDN.
export default function ModelsPage(props: PageProps<"/models">) {
  return (
    <>
      <PageHeader
        title="Models"
        description="Filter by lab, provider, capability, context window and price. Prices are the lab's official per-1M-token rate, or the median across providers when the lab doesn't sell the model directly."
      />
      <Suspense fallback={<ResultsSkeleton />}>
        <ModelsResults searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function ModelsResults({ searchParams }: Pick<PageProps<"/models">, "searchParams">) {
  const params = await searchParams;
  const query = parseModelListQuery(params);
  const view = params.view === "grid" ? "grid" : "table";
  const [result, options] = await Promise.all([listModels(query), getFilterOptions()]);

  return (
    // One shared transition: a click in the sidebar dims the results instantly.
    <PendingNavigationProvider>
      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <ModelFilters query={query} options={options} view={view} />
        <PendingRegion>
          <ModelsToolbar query={query} total={result.total} view={view} />
          {result.items.length === 0 ? (
            <EmptyState title="No models match these filters">
              Try removing a filter or widening the price / context range.
              {query.q && <DidYouMean q={query.q} />}
            </EmptyState>
          ) : view === "grid" ? (
            <ModelGrid models={result.items} />
          ) : (
            <ModelTable models={result.items} />
          )}
          <Pagination page={result.page} totalPages={result.totalPages} href={(page) => modelsHref(query, { page, view })} />
        </PendingRegion>
      </div>
    </PendingNavigationProvider>
  );
}

/** Exact filters found nothing — fall back to the typo-tolerant search. */
async function DidYouMean({ q }: { q: string }) {
  const { models } = await globalSearch(q, 5);
  if (!models.length) return null;
  return (
    <span className="mt-3 block">
      Did you mean{" "}
      {models.map((m, i) => (
        <span key={m.slug}>
          {i > 0 && ", "}
          <Link href={modelHref(m.slug)} className="text-accent hover:underline">{m.name}</Link>
        </span>
      ))}
      ?
    </span>
  );
}

function ResultsSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
      <div className="hidden space-y-3 lg:block">
        {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-6" />)}
      </div>
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        {Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="h-12" />)}
      </div>
    </div>
  );
}

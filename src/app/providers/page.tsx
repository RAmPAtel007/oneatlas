import type { Metadata } from "next";
import { Suspense } from "react";
import { ProviderDirectory } from "@/components/provider-directory";
import { PageHeader, Skeleton } from "@/components/ui";
import { listProviders } from "@/server/services/catalog";

export const metadata: Metadata = {
  title: "Inference providers",
  description: "Every API provider that serves AI models, with catalog size and pricing.",
};

export default function ProvidersPage() {
  return (
    <>
      <PageHeader
        title="Inference providers"
        description="Companies that serve models over an API — first-party labs, clouds, GPU hosts and routers. Search, then open a provider to see every model it serves and at what price."
      />
      <Suspense fallback={<Skeleton className="h-[600px]" />}>
        <Directory />
      </Suspense>
    </>
  );
}

async function Directory() {
  const providers = await listProviders();
  return <ProviderDirectory providers={providers} />;
}

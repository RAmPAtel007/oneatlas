import type { Metadata } from "next";
import { Badge, Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "API",
  description: "Free, read-only REST API for the OneAtlas model catalog.",
};

const ENDPOINTS = [
  {
    path: "/api/v1/models",
    example: "/api/v1/models?q=claude&cap=reasoning,vision&sort=price&pageSize=5",
    description: "Search, filter, sort and paginate models.",
    params: [
      ["q", "Free text; every word must match name, id, family or lab"],
      ["lab, provider", "Comma-separated slugs, e.g. lab=openai,anthropic"],
      ["type", "text, image, video, speech, transcription, embedding, reranking, realtime"],
      ["cap", "reasoning, tools, structured-output, vision, audio-input, open-weights, free"],
      ["minContext / maxPrice", "Minimum context tokens / max input USD per 1M"],
      ["sort / order", "newest, name, price, context, intelligence, popularity · asc|desc"],
      ["page / pageSize", "1-based page; pageSize ≤ 100 (default 30)"],
      ["deprecated", "true to include deprecated models"],
    ],
  },
  { path: "/api/v1/models/{lab}/{model}", example: "/api/v1/models/anthropic/claude-opus-5-5", description: "Full detail: every provider offering, benchmark scores with rank, related models." },
  { path: "/api/v1/compare", example: "/api/v1/compare?models=openai/gpt-6-astra,anthropic/claude-opus-5-5", description: "Up to 4 models side by side." },
  { path: "/api/v1/search", example: "/api/v1/search?q=gemni", description: "Typo-tolerant search across models, labs and providers." },
  { path: "/api/v1/labs", example: "/api/v1/labs", description: "All labs with model counts and latest release." },
  { path: "/api/v1/labs/{slug}", example: "/api/v1/labs/mistral", description: "A lab, its models and the providers that serve them." },
  { path: "/api/v1/providers", example: "/api/v1/providers", description: "All providers with catalog size and cheapest price." },
  { path: "/api/v1/providers/{slug}", example: "/api/v1/providers/groq", description: "Every model a provider serves, with prices." },
  { path: "/api/v1/benchmarks", example: "/api/v1/benchmarks", description: "Available benchmarks and how many models each covers." },
  { path: "/api/v1/benchmarks/{slug}", example: "/api/v1/benchmarks/aa-intelligence?limit=10&openWeights=true", description: "Ranked leaderboard (ties share a rank)." },
  { path: "/api/v1/value", example: "/api/v1/value", description: "Intelligence vs blended price with the Pareto frontier flagged." },
  { path: "/api/v1/filters", example: "/api/v1/filters", description: "Facet values with counts (powers the filter sidebar)." },
  { path: "/api/v1/stats", example: "/api/v1/stats", description: "Catalog totals, capability coverage, last sync time." },
];

export default function ApiDocsPage() {
  return (
    <>
      <PageHeader
        title="REST API"
        description="The same API the OneAtlas UI uses. Read-only, JSON, no key required. Responses are CDN-cached for 5 minutes."
      />
      <div className="space-y-6">
        <Card className="p-5 text-sm">
          <h2 className="mb-2 font-semibold">Response format</h2>
          <pre className="overflow-x-auto rounded-lg bg-subtle p-3 font-mono text-xs">{`// 200
{ "data": [...], "meta": { "pagination": { "page": 1, "pageSize": 30, "total": 585, "totalPages": 20 } } }

// 400 / 404 / 500
{ "error": { "code": "invalid_query", "message": "…", "details": [{ "param": "sort", "message": "…" }] } }`}</pre>
        </Card>

        <div className="space-y-3">
          {ENDPOINTS.map((e) => (
            <Card key={e.path} className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="good">GET</Badge>
                <code className="font-mono text-sm font-medium">{e.path}</code>
              </div>
              <p className="mt-2 text-sm text-muted">{e.description}</p>
              {e.params && (
                <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[180px_1fr]">
                  {e.params.map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="font-mono text-xs">{k}</dt>
                      <dd className="text-muted">{v}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <a href={e.example} target="_blank" rel="noreferrer" className="mt-3 inline-block font-mono text-xs break-all text-accent hover:underline">
                Try it → {e.example}
              </a>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}

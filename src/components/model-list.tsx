import Link from "next/link";
import { CapabilityIcons } from "@/components/capabilities";
import { CompareButton } from "@/components/compare/compare-store";
import { LabAvatar } from "@/components/lab-avatar";
import { Badge, Card } from "@/components/ui";
import { formatMonth, formatPrice, formatTokens, modelHref, typeLabel } from "@/lib/format";
import type { ModelListItem } from "@/server/services/models";

/** Server-rendered model table and card grid used by /models, labs and home. */

function PriceCell({ m }: { m: ModelListItem }) {
  if (m.inputPrice == null) return <span className="text-muted">—</span>;
  return (
    <span className="tabular" title={m.priceIsOfficial ? "Official lab price" : "Median across providers"}>
      {formatPrice(m.inputPrice)}
      <span className="text-muted"> / </span>
      {formatPrice(m.outputPrice)}
    </span>
  );
}

function IntelligenceCell({ score }: { score: number | null }) {
  if (score == null) return <span className="text-muted">—</span>;
  return (
    <div className="flex items-center gap-2" title="Artificial Analysis Intelligence Index">
      <div className="h-1.5 w-12 overflow-hidden rounded-full bg-subtle">
        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (score / 70) * 100)}%` }} />
      </div>
      <span className="tabular text-xs">{score.toFixed(1)}</span>
    </div>
  );
}

export function ModelTable({ models, showLab = true }: { models: ModelListItem[]; showLab?: boolean }) {
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted">
            <th className="px-4 py-2.5 font-medium">Model</th>
            <th className="px-3 py-2.5 font-medium">Context</th>
            <th className="px-3 py-2.5 font-medium">
              Price <span className="font-normal">in / out per 1M</span>
            </th>
            <th className="px-3 py-2.5 font-medium">Intelligence</th>
            <th className="px-3 py-2.5 font-medium">Capabilities</th>
            <th className="px-3 py-2.5 text-right font-medium">Providers</th>
            <th className="px-3 py-2.5 font-medium">Released</th>
            <th className="w-10 px-3 py-2.5"><span className="sr-only">Compare</span></th>
          </tr>
        </thead>
        <tbody>
          {models.map((m) => (
            <tr key={m.id} className="border-b last:border-0 hover:bg-subtle/60">
              <td className="px-4 py-2.5">
                <Link href={modelHref(m.slug)} className="group flex items-center gap-3">
                  {showLab && <LabAvatar slug={m.lab.slug} name={m.lab.name} size="sm" />}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-medium group-hover:text-accent">{m.name}</span>
                      {m.type !== "TEXT" && <Badge>{typeLabel(m.type)}</Badge>}
                      {m.status === "DEPRECATED" && <Badge tone="warn">Deprecated</Badge>}
                      {m.isFree && <Badge tone="good">Free tier</Badge>}
                    </div>
                    {showLab && <div className="truncate text-xs text-muted">{m.lab.name}</div>}
                  </div>
                </Link>
              </td>
              <td className="tabular px-3 py-2.5">{formatTokens(m.contextWindow)}</td>
              <td className="px-3 py-2.5 whitespace-nowrap"><PriceCell m={m} /></td>
              <td className="px-3 py-2.5"><IntelligenceCell score={m.intelligenceScore} /></td>
              <td className="px-3 py-2.5"><CapabilityIcons model={m} /></td>
              <td className="tabular px-3 py-2.5 text-right">{m.providerCount}</td>
              <td className="px-3 py-2.5 whitespace-nowrap text-muted">{formatMonth(m.releaseDate)}</td>
              <td className="px-3 py-2.5"><CompareButton slug={m.slug} name={m.name} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export function ModelCard({ m }: { m: ModelListItem }) {
  return (
    <Card className="group relative flex flex-col gap-3 p-4 transition-colors hover:border-accent/50">
      <div className="flex items-start gap-3">
        <LabAvatar slug={m.lab.slug} name={m.lab.name} />
        <div className="min-w-0 flex-1">
          <Link href={modelHref(m.slug)} className="block truncate font-medium after:absolute after:inset-0 group-hover:text-accent">
            {m.name}
          </Link>
          <div className="truncate text-xs text-muted">{m.lab.name} · {formatMonth(m.releaseDate)}</div>
        </div>
        <div className="relative z-10"><CompareButton slug={m.slug} name={m.name} /></div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <div className="text-muted">Context</div>
          <div className="tabular font-medium">{formatTokens(m.contextWindow)}</div>
        </div>
        <div>
          <div className="text-muted">Input / 1M</div>
          <div className="tabular font-medium">{formatPrice(m.inputPrice)}</div>
        </div>
        <div>
          <div className="text-muted">Intelligence</div>
          <div className="tabular font-medium">{m.intelligenceScore?.toFixed(1) ?? "—"}</div>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <CapabilityIcons model={m} />
        <span className="text-xs text-muted">{m.providerCount} providers</span>
      </div>
    </Card>
  );
}

export function ModelGrid({ models }: { models: ModelListItem[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {models.map((m) => (
        <ModelCard key={m.id} m={m} />
      ))}
    </div>
  );
}

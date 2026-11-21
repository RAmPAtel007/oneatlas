"use client";

import { LayoutGrid, Rows3 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic } from "react";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { modelsHref, SORT_PARAMS, type ModelListQuery, type SortParam } from "@/lib/query-schemas";
import { usePendingNavigation } from "./pending";

const SORT_LABELS: Record<SortParam, string> = {
  newest: "Newest",
  name: "Name",
  price: "Price (low → high)",
  context: "Context window",
  intelligence: "Intelligence",
  popularity: "Most providers",
};

export function ModelsToolbar({ query, total, view }: { query: ModelListQuery; total: number; view: "table" | "grid" }) {
  const router = useRouter();
  const { pending, start } = usePendingNavigation();
  const [sort, setOptimisticSort] = useOptimistic(query.sort);

  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted" aria-live="polite">
        {pending ? "Updating…" : `${formatNumber(total)} model${total === 1 ? "" : "s"}`}
      </p>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-muted">
          Sort
          <select
            value={sort}
            onChange={(e) => {
              const next = e.target.value as SortParam;
              start(() => {
                setOptimisticSort(next);
                router.replace(modelsHref(query, { sort: next, order: undefined, page: 1, view }), { scroll: false });
              });
            }}
            className="h-8 rounded-md border bg-card px-2 text-sm text-foreground"
          >
            {SORT_PARAMS.map((s) => (
              <option key={s} value={s}>
                {SORT_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <div className="flex rounded-md border bg-card p-0.5">
          {(["table", "grid"] as const).map((v) => {
            const Icon = v === "table" ? Rows3 : LayoutGrid;
            return (
              <Link
                key={v}
                href={modelsHref(query, { view: v })}
                scroll={false}
                aria-label={`${v} view`}
                aria-current={view === v}
                className={cn("rounded p-1.5", view === v ? "bg-subtle text-foreground" : "text-muted hover:text-foreground")}
              >
                <Icon className="size-4" />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

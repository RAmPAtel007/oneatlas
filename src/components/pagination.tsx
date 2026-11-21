import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";

/** Page links with ellipses: 1 … 4 5 [6] 7 8 … 20 */
export function Pagination({ page, totalPages, href }: { page: number; totalPages: number; href: (page: number) => string }) {
  if (totalPages <= 1) return null;
  const pages = new Set([1, totalPages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= totalPages));
  const sorted = [...pages].sort((a, b) => a - b);

  const linkCls = "inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-sm";
  return (
    <nav className="mt-6 flex items-center justify-center gap-1" aria-label="Pagination">
      {page > 1 ? (
        <Link href={href(page - 1)} className={cn(linkCls, "bg-card hover:bg-subtle")} aria-label="Previous page">
          <ChevronLeft className="size-4" />
        </Link>
      ) : (
        <span className={cn(linkCls, "opacity-40")}><ChevronLeft className="size-4" /></span>
      )}
      {sorted.map((p, i) => (
        <span key={p} className="flex items-center gap-1">
          {i > 0 && p - sorted[i - 1] > 1 && <span className="px-1 text-muted">…</span>}
          <Link
            href={href(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(linkCls, p === page ? "border-accent bg-accent-soft text-accent" : "bg-card hover:bg-subtle")}
          >
            {p}
          </Link>
        </span>
      ))}
      {page < totalPages ? (
        <Link href={href(page + 1)} className={cn(linkCls, "bg-card hover:bg-subtle")} aria-label="Next page">
          <ChevronRight className="size-4" />
        </Link>
      ) : (
        <span className={cn(linkCls, "opacity-40")}><ChevronRight className="size-4" /></span>
      )}
    </nav>
  );
}

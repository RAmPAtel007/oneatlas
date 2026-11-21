import { Globe2 } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { CommandPalette } from "./command-palette";
import { NAV } from "@/lib/nav";
import { MobileNav, NavLinks } from "./site-nav";

/**
 * Server component. Only the bits that read the current URL (active link
 * highlighting) are client components, and they sit inside <Suspense> so the
 * header itself stays in the prerendered static shell.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <Globe2 className="size-5 text-accent" />
          OneAtlas
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          <Suspense
            fallback={NAV.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-md px-2.5 py-1.5 text-sm text-muted">
                {n.label}
              </Link>
            ))}
          >
            <NavLinks />
          </Suspense>
        </nav>
        <div className="ml-auto flex flex-1 items-center justify-end gap-2 md:flex-none">
          <div className="flex-1 sm:flex-none">
            <CommandPalette />
          </div>
          <Suspense fallback={null}>
            <MobileNav />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

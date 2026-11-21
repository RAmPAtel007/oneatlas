"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { NAV } from "@/lib/nav";

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks() {
  const isActive = useIsActive();
  return NAV.map((n) => (
    <Link
      key={n.href}
      href={n.href}
      className={cn(
        "rounded-md px-2.5 py-1.5 text-sm transition-colors",
        isActive(n.href) ? "bg-subtle font-medium text-foreground" : "text-muted hover:text-foreground",
      )}
    >
      {n.label}
    </Link>
  ));
}

export function MobileNav() {
  const isActive = useIsActive();
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <button
        type="button"
        className="rounded-md p-2"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>
      {open && (
        <nav className="absolute inset-x-0 top-14 border-b bg-background px-4 py-2">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              className={cn("block rounded-md px-2 py-2 text-sm", isActive(n.href) ? "bg-subtle font-medium" : "text-muted")}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}

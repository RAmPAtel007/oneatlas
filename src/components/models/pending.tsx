"use client";

import { createContext, useContext, useTransition, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Filter clicks navigate to a new URL and the server renders the results,
 * which can take a second on serverless. This context shares one transition
 * between the filter sidebar, the toolbar and the results, so the results
 * dim with a progress bar the instant anything is clicked.
 */
interface PendingNavigation {
  pending: boolean;
  start: (fn: () => void) => void;
}

const PendingContext = createContext<PendingNavigation>({ pending: false, start: (fn) => fn() });

export function PendingNavigationProvider({ children }: { children: ReactNode }) {
  const [pending, startTransition] = useTransition();
  return <PendingContext value={{ pending, start: startTransition }}>{children}</PendingContext>;
}

export function usePendingNavigation() {
  return useContext(PendingContext);
}

export function PendingRegion({ children }: { children: ReactNode }) {
  const { pending } = usePendingNavigation();
  return (
    <div aria-busy={pending} className="relative min-w-0">
      {pending && (
        <div className="absolute inset-x-0 -top-3 h-0.5 overflow-hidden rounded-full bg-accent/20" role="progressbar" aria-label="Updating results">
          <div className="h-full w-full animate-pulse bg-accent" />
        </div>
      )}
      <div className={cn("transition-opacity duration-150", pending && "pointer-events-none opacity-50")}>{children}</div>
    </div>
  );
}

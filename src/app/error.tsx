"use client";

import { useEffect } from "react";

/** Route-level error boundary: keeps the header/nav usable and offers a retry. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="max-w-md text-sm text-muted">
        We couldn’t load this page. It’s usually temporary — try again in a moment.
        {error.digest && <span className="mt-1 block font-mono text-xs">Ref: {error.digest}</span>}
      </p>
      <button type="button" onClick={reset} className="mt-2 h-9 rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg">
        Try again
      </button>
    </div>
  );
}

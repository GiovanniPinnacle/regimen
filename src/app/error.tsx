"use client";

// app/error.tsx — page-level error boundary.
//
// Catches errors thrown while rendering a route segment (server or
// client components, data fetches). Shows a recoverable card: "Try
// again" calls Next 16.2's `unstable_retry()`, which re-fetches AND
// re-renders the segment (the older `reset()` only re-renders, so a
// failed server fetch would just fail again). Fallback link to /today.

import { useEffect } from "react";
import Card from "@/components/ui/Card";
import Button, { ButtonLink } from "@/components/ui/Button";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // Prod telemetry would hook in here.
    console.error("Page error boundary caught:", error);
  }, [error]);

  return (
    <div className="py-12 max-w-md mx-auto">
      <Card padding="xl" role="alert">
        <div className="text-eyebrow uppercase mb-2 text-[var(--error)]">
          Something broke
        </div>
        <h1 className="text-title-2 mb-2 text-[var(--foreground)]">
          This page hit an error
        </h1>
        <p className="text-footnote mb-5 text-[var(--muted)]">
          Your data is fine — the page just couldn&apos;t render this time.
          Try again, or head back to Today.
        </p>

        {/* Name + message + digest (no stack) — what we'd ask the user
            to paste anyway; cheaper than a DevTools round trip. */}
        {error.message || error.digest ? (
          <details className="mb-5 rounded-[var(--r-sm)] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 font-mono text-caption text-[var(--foreground-soft)] break-words">
            <summary className="cursor-pointer list-none font-sans font-semibold text-[var(--muted)]">
              Error details
            </summary>
            <div className="mt-2">
              {error.name ? <div className="font-semibold">{error.name}</div> : null}
              {error.message ? <div>{error.message}</div> : null}
              {error.digest ? (
                <div className="mt-1 text-[var(--muted)]">digest: {error.digest}</div>
              ) : null}
            </div>
          </details>
        ) : null}

        <div className="flex gap-2">
          <Button
            variant="primary"
            icon="refresh"
            fullWidth
            onClick={() => unstable_retry()}
          >
            Try again
          </Button>
          <ButtonLink href="/today" variant="secondary">
            Today
          </ButtonLink>
        </div>
      </Card>
    </div>
  );
}

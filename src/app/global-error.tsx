"use client";

// app/global-error.tsx — root-level error boundary.
//
// Catches errors thrown in the root layout itself, so it replaces the
// whole document: it must render <html>/<body> and bring its own styles
// (globals.css carries the design tokens). No app chrome — just a card
// and a retry. `unstable_retry()` (Next 16.2) re-fetches + re-renders.

import "./globals.css";
import { useEffect } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("Global error boundary caught:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-dvh flex items-center justify-center p-6 bg-[var(--background)] text-[var(--foreground)] font-sans antialiased">
        <title>Regimen — something went wrong</title>
        <Card padding="xl" className="w-full max-w-sm text-center" role="alert">
          <h1 className="text-title-2 mb-2">App hit an error</h1>
          <p className="text-footnote mb-5 text-[var(--muted)]">
            Something at the root level crashed. Your data is safe — try
            again.
          </p>
          {error.digest ? (
            <p className="mb-4 font-mono text-caption text-[var(--muted)]">
              digest: {error.digest}
            </p>
          ) : null}
          <Button
            variant="primary"
            icon="refresh"
            fullWidth
            onClick={() => unstable_retry()}
          >
            Try again
          </Button>
        </Card>
      </body>
    </html>
  );
}

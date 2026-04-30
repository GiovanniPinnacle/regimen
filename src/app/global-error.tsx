"use client";

// app/global-error.tsx — root-level error boundary.
//
// Catches errors thrown in the root layout (or higher) — i.e. errors
// that the per-page error.tsx can't handle because the layout itself
// crashed. Must include <html> + <body> tags since the rest of the
// layout never rendered.
//
// Kept intentionally minimal — no app chrome, no Coach FAB, no nav.
// The user can always tap "Reload" and try again.

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error boundary caught:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          background: "#0E2A1F",
          color: "#FBFAF6",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          margin: 0,
        }}
      >
        <div style={{ maxWidth: 360, textAlign: "center" }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 600,
              marginBottom: 8,
              letterSpacing: "-0.01em",
            }}
          >
            App hit an error
          </div>
          <p
            style={{
              fontSize: 14,
              opacity: 0.75,
              lineHeight: 1.5,
              marginBottom: 20,
            }}
          >
            Something at the root level crashed. Reload to try again — your
            data is safe.
          </p>
          <button
            onClick={() => reset()}
            style={{
              background: "#22c55e",
              color: "#0E2A1F",
              border: "none",
              padding: "10px 20px",
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}

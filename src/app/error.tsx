"use client";

// app/error.tsx — page-level error boundary.
//
// Catches any error thrown during render of a page or its children
// (server or client components, data-fetch errors, etc.). Replaces the
// generic Next.js error screen with a recoverable UI: shows a friendly
// message, a "Try again" button (which calls reset() to remount the
// page), and a fallback link back to /today.
//
// In dev, also surfaces digest + message so the bug is visible.

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console for client-side debugging. Prod telemetry would
    // hook in here.
    console.error("Page error boundary caught:", error);
  }, [error]);

  return (
    <div className="py-12 max-w-md mx-auto">
      <div className="rounded-2xl card-glass p-6">
        <div
          className="text-[11px] uppercase tracking-wider mb-2"
          style={{
            color: "var(--error)",
            fontWeight: 700,
            letterSpacing: "0.08em",
          }}
        >
          Something broke
        </div>
        <h1
          className="text-[22px] leading-tight mb-2"
          style={{ fontWeight: 600, letterSpacing: "-0.01em" }}
        >
          This page hit an error
        </h1>
        <p
          className="text-[13px] leading-relaxed mb-5"
          style={{ color: "var(--muted)" }}
        >
          Don&apos;t worry — your data is fine. The page just couldn&apos;t
          render this time. Try again, or head back to Today and come at
          it from there.
        </p>

        {process.env.NODE_ENV !== "production" && error.message ? (
          <div
            className="rounded-lg px-3 py-2 mb-4 text-[11px] font-mono"
            style={{
              background: "var(--surface-alt)",
              color: "var(--foreground-soft)",
              border: "1px solid var(--border)",
              wordBreak: "break-word",
            }}
          >
            <div style={{ fontWeight: 600 }}>{error.name}</div>
            <div>{error.message}</div>
            {error.digest ? (
              <div
                className="mt-1"
                style={{ color: "var(--muted)" }}
              >
                digest: {error.digest}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex gap-2">
          <button
            onClick={() => reset()}
            className="flex-1 px-4 py-2.5 rounded-lg text-[13px]"
            style={{
              background: "var(--accent)",
              color: "#FBFAF6",
              fontWeight: 700,
            }}
          >
            Try again
          </button>
          <Link
            href="/today"
            className="px-4 py-2.5 rounded-lg text-[13px] inline-flex items-center justify-center"
            style={{
              background: "var(--surface-alt)",
              color: "var(--foreground)",
              fontWeight: 600,
            }}
          >
            Today
          </Link>
        </div>
      </div>
    </div>
  );
}

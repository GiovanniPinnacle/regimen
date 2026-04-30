// app/not-found.tsx — friendly 404 page.
//
// Replaces the generic Next.js 404 with a recoverable UI: brief message
// + a single CTA back to /today. Kept lean — no Coach prompts, no
// secondary actions.

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-16 max-w-md mx-auto">
      <div className="rounded-2xl card-glass p-6 text-center">
        <div
          className="text-[42px] leading-none mb-2"
          style={{
            background:
              "linear-gradient(135deg, var(--pro) 0%, var(--accent) 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            fontWeight: 700,
            letterSpacing: "-0.02em",
          }}
        >
          404
        </div>
        <h1
          className="text-[20px] leading-tight mt-3 mb-2"
          style={{ fontWeight: 600, letterSpacing: "-0.01em" }}
        >
          That page doesn&apos;t exist
        </h1>
        <p
          className="text-[13px] leading-relaxed mb-5"
          style={{ color: "var(--muted)" }}
        >
          Maybe a link went stale, or the URL is mis-typed. Head back to
          Today and you&apos;re right where you should be.
        </p>
        <Link
          href="/today"
          className="inline-block px-4 py-2.5 rounded-lg text-[13px]"
          style={{
            background: "var(--accent)",
            color: "#FBFAF6",
            fontWeight: 700,
          }}
        >
          Back to Today
        </Link>
      </div>
    </div>
  );
}

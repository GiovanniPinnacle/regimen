"use client";

// MoreFab — small gear icon top-right, fixed-position. Replaces the
// "More" tab that used to live in the bottom nav (now Today / Fuel /
// + / Train / Coach). Routes to /more for stack management, profile,
// settings, integrations, etc.
//
// Hidden on auth/onboarding screens. Hidden on /more itself (no
// point linking back to where you are).

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function MoreFab() {
  const pathname = usePathname();
  if (
    !pathname ||
    pathname === "/" ||
    pathname === "/more" ||
    pathname.startsWith("/signin") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/onboard") ||
    pathname.startsWith("/welcome") ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/terms")
  ) {
    return null;
  }
  return (
    <Link
      href="/more"
      aria-label="Settings & more"
      className="fixed top-4 right-4 z-40 h-10 w-10 rounded-full flex items-center justify-center active:scale-95 transition-all"
      style={{
        background: "var(--surface-glass)",
        border: "1px solid var(--border)",
        color: "var(--muted)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.24)",
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.36.16.69.36 1 .6.36.16.69.36 1 .6h.09a2 2 0 1 1 0 4H21a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </Link>
  );
}

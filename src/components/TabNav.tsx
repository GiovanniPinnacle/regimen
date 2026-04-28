"use client";

// Bottom nav — 5 peer destinations users return to often. Apple HIG.
// Today (engagement) · Protocols (revenue) · Stack (manage) ·
// Insights (patterns + refine + trends + costs) · More
//
// Insights is a broader umbrella than the old "Refine" — frequency-of-visit
// fits a daily-to-weekly cadence, vs Refine's weekly-at-most.

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** Additional matching prefixes (so /protocols/foo highlights Protocols). */
  matches?: string[];
};

const TABS: Tab[] = [
  {
    href: "/today",
    label: "Today",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="17" rx="2.5" />
        <path d="M3 10h18" />
        <path d="M8 2v4M16 2v4" />
      </svg>
    ),
  },
  {
    href: "/protocols",
    label: "Protocols",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 4h6a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v0a2 2 0 0 1 2-2z" />
        <path d="M5 6a2 2 0 0 1 2-2M19 6a2 2 0 0 0-2-2" />
        <path d="M5 6v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6" />
        <path d="M9 13l2 2 4-4" />
      </svg>
    ),
  },
  {
    href: "/stack",
    label: "Stack",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="4" rx="1.5" />
        <rect x="3" y="10" width="18" height="4" rx="1.5" />
        <rect x="3" y="16" width="18" height="4" rx="1.5" />
      </svg>
    ),
  },
  {
    href: "/insights",
    label: "Insights",
    matches: ["/refine"],
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 20V10" />
        <path d="M9 20V4" />
        <path d="M15 20v-7" />
        <path d="M21 20V8" />
      </svg>
    ),
  },
  {
    href: "/more",
    label: "More",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="5" cy="12" r="1.6" />
        <circle cx="12" cy="12" r="1.6" />
        <circle cx="19" cy="12" r="1.6" />
      </svg>
    ),
  },
];

export default function TabNav() {
  const pathname = usePathname();
  // Hide on auth + public landing pages
  if (
    pathname === "/" ||
    pathname?.startsWith("/signin") ||
    pathname?.startsWith("/auth/") ||
    pathname?.startsWith("/onboard")
  ) {
    return null;
  }
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 glass-strong border-hair-t"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0)",
      }}
      aria-label="Primary"
    >
      <ul className="max-w-3xl mx-auto grid grid-cols-5">
        {TABS.map((tab) => {
          const active =
            pathname === tab.href ||
            (tab.href !== "/" && pathname?.startsWith(tab.href)) ||
            (tab.matches?.some((m) => pathname?.startsWith(m)) ?? false);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className="relative flex flex-col items-center justify-center gap-1 py-2.5 w-full transition-all"
                style={{
                  color: active ? "var(--olive)" : "var(--muted)",
                  minHeight: "56px",
                }}
                aria-current={active ? "page" : undefined}
              >
                <span
                  className="transition-all"
                  style={{
                    opacity: active ? 1 : 0.7,
                    transform: active ? "scale(1.05)" : "scale(1)",
                  }}
                >
                  {tab.icon}
                </span>
                <span
                  className="text-[11px] transition-all"
                  style={{
                    fontWeight: active ? 600 : 500,
                    letterSpacing: active ? "0.005em" : "0",
                    opacity: active ? 1 : 0.85,
                  }}
                >
                  {tab.label}
                </span>
                {active && (
                  <span
                    aria-hidden
                    className="absolute"
                    style={{
                      top: 0,
                      width: "28px",
                      height: "2.5px",
                      background: "var(--olive)",
                      borderRadius: "0 0 3px 3px",
                    }}
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

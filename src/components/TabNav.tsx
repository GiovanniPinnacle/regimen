"use client";

// Bottom nav — 5 tabs, optimized for revenue + daily engagement.
// Today (engagement) · Protocols (affiliate/premium revenue driver) ·
// Stack (manage) · Refine (Pro tier driver) · More (everything else).
// Scan + Recipes moved to /more "Tools" since they're occasional, not daily.

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

const TABS: Tab[] = [
  {
    href: "/today",
    label: "Today",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="17" rx="2" />
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
        <path d="M5 6h0a2 2 0 0 1 2-2h0M19 6h0a2 2 0 0 0-2-2h0" />
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
        <rect x="3" y="4" width="18" height="4" rx="1" />
        <rect x="3" y="10" width="18" height="4" rx="1" />
        <rect x="3" y="16" width="18" height="4" rx="1" />
      </svg>
    ),
  },
  {
    href: "/refine",
    label: "Refine",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" />
        <path d="M19 14l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />
        <path d="M5 17l.5 1.5 1.5.5-1.5.5L5 21l-.5-1.5L3 19l1.5-.5z" />
      </svg>
    ),
  },
  {
    href: "/more",
    label: "More",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="5" cy="12" r="1.5" />
        <circle cx="12" cy="12" r="1.5" />
        <circle cx="19" cy="12" r="1.5" />
      </svg>
    ),
  },
];

export default function TabNav() {
  const pathname = usePathname();
  // Hide on auth pages
  if (
    pathname?.startsWith("/signin") ||
    pathname?.startsWith("/auth/")
  ) {
    return null;
  }
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 glass-strong border-hair-t"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0)",
      }}
    >
      <ul className="max-w-3xl mx-auto grid grid-cols-5">
        {TABS.map((tab) => {
          const active =
            pathname === tab.href ||
            (tab.href !== "/" && pathname?.startsWith(tab.href));
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className="flex flex-col items-center justify-center gap-1 py-3 w-full transition-colors"
                style={{
                  color: active ? "var(--olive)" : "var(--muted)",
                }}
              >
                <span style={{ opacity: active ? 1 : 0.8 }}>{tab.icon}</span>
                <span
                  className="text-[11px]"
                  style={{ fontWeight: active ? 600 : 400 }}
                >
                  {tab.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

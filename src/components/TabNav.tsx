"use client";

// Bottom nav — 4 peer destinations + central "+" button for quick actions.
// Today (engagement) · Stack (manage) · [+] · Insights (patterns) · More
//
// The + button opens QuickActionSheet — a bottom-sheet menu giving users
// one-tap access to Scan, Add item, Voice memo, Search, Browse protocols,
// and Ask Coach from anywhere in the app. Drops Protocols from the
// primary nav (still available via /more + the sheet) to make room.

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import QuickActionSheet from "@/components/QuickActionSheet";

type Tab = {
  href: string;
  label: string;
  icon: React.ReactNode;
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
    matches: ["/protocols"],
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
  const [sheetOpen, setSheetOpen] = useState(false);

  // Hide on auth + public landing pages
  if (
    pathname === "/" ||
    pathname?.startsWith("/signin") ||
    pathname?.startsWith("/auth/") ||
    pathname?.startsWith("/onboard")
  ) {
    return null;
  }

  // Render tabs in this layout: [Today][Stack] [+] [Insights][More]
  // Grid is 5 columns; slot 3 is the + button.
  const leftTabs = TABS.slice(0, 2);
  const rightTabs = TABS.slice(2);

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 glass-strong"
        style={{
          paddingBottom: "env(safe-area-inset-bottom, 0)",
          borderTop: "1px solid var(--border)",
        }}
        aria-label="Primary"
      >
        <ul className="max-w-3xl mx-auto grid grid-cols-5 items-end">
          {leftTabs.map((tab) => (
            <TabItem key={tab.href} tab={tab} pathname={pathname ?? ""} />
          ))}

          {/* Central + button */}
          <li className="flex justify-center items-end">
            <button
              onClick={() => setSheetOpen(true)}
              aria-label="Quick actions"
              className="relative -translate-y-3 active:scale-95 transition-transform"
              style={{
                height: 52,
                width: 52,
                borderRadius: 18,
                background:
                  "linear-gradient(135deg, var(--pro) 0%, #6D28D9 100%)",
                color: "#FBFAF6",
                boxShadow:
                  "0 12px 28px rgba(168, 85, 247, 0.40), 0 4px 10px rgba(109, 40, 217, 0.30)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </li>

          {rightTabs.map((tab) => (
            <TabItem key={tab.href} tab={tab} pathname={pathname ?? ""} />
          ))}
        </ul>
      </nav>

      <QuickActionSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </>
  );
}

function TabItem({ tab, pathname }: { tab: Tab; pathname: string }) {
  const active =
    pathname === tab.href ||
    (tab.href !== "/" && pathname?.startsWith(tab.href)) ||
    (tab.matches?.some((m) => pathname?.startsWith(m)) ?? false);
  return (
    <li>
      <Link
        href={tab.href}
        className="relative flex flex-col items-center justify-center gap-1 py-2.5 w-full transition-all"
        style={{
          color: active ? "var(--accent)" : "var(--muted)",
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
              background: "var(--accent)",
              borderRadius: "0 0 3px 3px",
            }}
          />
        )}
      </Link>
    </li>
  );
}

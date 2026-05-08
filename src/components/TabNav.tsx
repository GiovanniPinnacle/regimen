"use client";

// Bottom nav — 4 activity-domain destinations + central "+" universal
// AI capture button.
//
//   Today (daily checklist) · Fuel (food/intake) · [+] · Train (movement) · Coach (AI)
//
// Restructured from feature-organized (Today/Stack/Insights/More) to
// activity-domain (Today/Fuel/Train/Coach) so users tap based on what
// they're DOING, not what kind of data they want to see. Stack +
// Insights + Profile + everything else lives in /more, accessible via
// a gear icon top-right of every page (not in the bottom nav).
//
// The + button opens UniversalCapture — voice/photo/text in, Claude
// classifies, routes to the right system. "I just took my magnesium"
// checks the item off. Photo of meal logs an intake_log row with
// macros. "Add fish oil" fires a Coach proposal. Same entry from any
// tab — user never has to think about where to type what.

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import UniversalCapture from "@/components/UniversalCapture";

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
    href: "/fuel",
    label: "Fuel",
    matches: ["/recipes"],
    icon: (
      // Knife & fork — food/eating connotation without the "diet" baggage
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 2v8a3 3 0 0 0 6 0V2" />
        <path d="M8 10v12" />
        <path d="M16 22V13c-2-1-3-3-3-5V2c4 0 5 2 5 5v8" />
      </svg>
    ),
  },
  {
    href: "/train",
    label: "Train",
    matches: ["/fit"],
    icon: (
      // Dumbbell
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12h2" />
        <path d="M20 12h2" />
        <rect x="4" y="8" width="3" height="8" rx="1" />
        <rect x="17" y="8" width="3" height="8" rx="1" />
        <rect x="7" y="10" width="10" height="4" rx="1" />
      </svg>
    ),
  },
  {
    href: "/coach",
    label: "Coach",
    matches: ["/insights", "/refine", "/coach-history"],
    icon: (
      // Sparkle — same vocabulary as the Coach FAB
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" />
        <path d="M19 14l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />
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
                color: "#FFFFFF",
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

      <UniversalCapture
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

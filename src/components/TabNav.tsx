"use client";

// Bottom nav — five slots:
//
//   Today · Fuel · [+ Log] · Train · You
//
// Activity domains on the left/right, universal capture in the middle.
// Coach is not a tab: it opens as a full-screen overlay from the sparkle
// button in every PageHeader. "You" is the settings-style hub (stack,
// shopping, labs, progress, profile, settings).
//
// The + opens UniversalCapture — voice/photo/text in, Claude classifies
// and routes. Any page can also open it by dispatching a
// `regimen:capture` CustomEvent (detail.hint biases the classifier, e.g.
// Train's "Log a workout" sends { hint: "workout" }). UniversalCapture
// reads the hint itself and clears it on close.

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import UniversalCapture from "@/components/UniversalCapture";
import Icon, { type IconName } from "@/components/Icon";

type Tab = {
  href: string;
  label: string;
  icon: IconName;
  matches?: string[];
};

const LEFT: Tab[] = [
  { href: "/today", label: "Today", icon: "calendar" },
  { href: "/fuel", label: "Fuel", icon: "utensils", matches: ["/recipes"] },
];

const RIGHT: Tab[] = [
  { href: "/train", label: "Train", icon: "dumbbell" },
  {
    href: "/you",
    label: "You",
    icon: "user",
    matches: [
      "/stack",
      "/items",
      "/purchases",
      "/wishlist",
      "/audit",
      "/tests",
      "/data",
      "/protocols",
      "/recap",
      "/achievements",
      "/insights",
      "/coach-history",
      "/about-me",
      "/profile",
      "/hard-nos",
      "/account",
      "/costs",
      "/changelog",
      "/reviews",
      "/sequence",
      "/dedupe",
      "/privacy",
      "/terms",
      "/strategy",
      "/admin",
    ],
  },
];

function matchesPath(pathname: string, base: string) {
  return pathname === base || pathname.startsWith(base + "/");
}

export default function TabNav() {
  const pathname = usePathname() ?? "";
  const [captureOpen, setCaptureOpen] = useState(false);

  // Programmatic open — UniversalCapture has its own listener for the
  // same event that stores the hint.
  useEffect(() => {
    function onCapture() {
      setCaptureOpen(true);
    }
    window.addEventListener("regimen:capture", onCapture);
    return () => window.removeEventListener("regimen:capture", onCapture);
  }, []);

  // Hide on auth + public landing pages
  if (
    pathname === "/" ||
    pathname.startsWith("/signin") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/onboard")
  ) {
    return null;
  }

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 glass-strong"
        style={{
          zIndex: "var(--z-nav)" as unknown as number,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          paddingLeft: "env(safe-area-inset-left, 0px)",
          paddingRight: "env(safe-area-inset-right, 0px)",
          borderWidth: "1px 0 0 0",
          boxShadow: "none",
        }}
        aria-label="Primary"
      >
        <ul className="max-w-3xl mx-auto grid grid-cols-5 items-stretch">
          {LEFT.map((tab) => (
            <TabItem key={tab.href} tab={tab} pathname={pathname} />
          ))}

          <li className="flex items-center justify-center">
            <button
              type="button"
              onClick={() => setCaptureOpen(true)}
              aria-label="Log anything"
              aria-haspopup="dialog"
              className="flex h-[44px] w-[52px] items-center justify-center rounded-[16px] bg-[var(--primary)] text-[var(--primary-fg)] shadow-[var(--shadow-button)] transition-transform duration-150 active:scale-95"
            >
              <Icon name="plus" size={24} strokeWidth={2.2} />
            </button>
          </li>

          {RIGHT.map((tab) => (
            <TabItem key={tab.href} tab={tab} pathname={pathname} />
          ))}
        </ul>
      </nav>

      <UniversalCapture
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
      />
    </>
  );
}

function TabItem({ tab, pathname }: { tab: Tab; pathname: string }) {
  const active =
    matchesPath(pathname, tab.href) ||
    (tab.matches?.some((m) => matchesPath(pathname, m)) ?? false);
  return (
    <li>
      <Link
        href={tab.href}
        className="relative flex min-h-[56px] w-full flex-col items-center justify-center gap-1 py-2 transition-colors duration-150"
        style={{ color: active ? "var(--foreground)" : "var(--muted)" }}
        aria-current={active ? "page" : undefined}
      >
        {active && (
          <span
            aria-hidden
            className="absolute top-0 h-[2px] w-7 rounded-b-full"
            style={{ background: "var(--foreground)" }}
          />
        )}
        <Icon name={tab.icon} size={22} strokeWidth={active ? 1.9 : 1.6} />
        <span
          className="text-[11px] leading-none"
          style={{ fontWeight: active ? 600 : 500 }}
        >
          {tab.label}
        </span>
      </Link>
    </li>
  );
}

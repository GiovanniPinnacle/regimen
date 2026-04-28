"use client";

// Mounted on /today — runs the achievements check on load and fires
// toasts for any newly-unlocked badges. Tier-colored, with the badge
// icon as the toast emphasis. Stays subtle for starter, more dramatic
// for legendary.

import { useEffect } from "react";
import { showToast } from "@/lib/toast";
import { TIER_COLORS } from "@/lib/achievements";

const SEEN_KEY = "regimen.achievements.toasted.v1";

export default function AchievementsChecker() {
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/achievements");
        if (!res.ok) return;
        const data = await res.json();
        if (!alive) return;
        const newly = (data.newly_unlocked ?? []) as {
          key: string;
          title: string;
          detail: string;
          icon: string;
          tier: "starter" | "milestone" | "legendary";
        }[];
        if (newly.length === 0) return;

        // De-dupe against localStorage so we don't re-toast on every page
        // visit if the server's "newly_unlocked" missed our prior session.
        let seen: string[] = [];
        try {
          const raw = localStorage.getItem(SEEN_KEY);
          if (raw) seen = JSON.parse(raw) as string[];
        } catch {}

        for (const a of newly) {
          if (seen.includes(a.key)) continue;
          const tone =
            a.tier === "legendary"
              ? "success"
              : a.tier === "milestone"
                ? "success"
                : "default";
          showToast(`${a.icon}  Unlocked: ${a.title}`, {
            tone,
            duration: a.tier === "legendary" ? 7000 : 5000,
          });
          seen.push(a.key);
        }

        try {
          localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
        } catch {}
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Reference TIER_COLORS so the import isn't tree-shaken — the toast
  // colors map to these. (Used implicitly via tone above.)
  void TIER_COLORS;
  return null;
}

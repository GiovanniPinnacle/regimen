"use client";

// Mounted on /today — runs the achievements check on load and fires a
// toast for each newly-unlocked badge, led by the badge's vector glyph.
// Legendary unlocks linger a little longer.

import { useEffect } from "react";
import { showToast } from "@/lib/toast";
import { ACHIEVEMENTS_BY_KEY, type AchievementKey } from "@/lib/achievements";

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
          const def = ACHIEVEMENTS_BY_KEY[a.key as AchievementKey];
          showToast(`Unlocked: ${a.title}`, {
            icon: def?.glyph ?? "award",
            duration: a.tier === "legendary" ? 7000 : 5000,
            action: {
              label: "View",
              onClick: () => {
                window.location.href = "/achievements";
              },
            },
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

  return null;
}

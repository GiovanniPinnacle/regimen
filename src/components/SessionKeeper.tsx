"use client";

// Keeps the auth session fresh on iOS PWA + desktop.
// - Refreshes session on mount
// - Refreshes when the tab/PWA becomes visible after backgrounding
// - Refreshes on window focus
// - Forces a refresh every time the PWA resumes (iOS Safari ITP needs
//   frequent first-party interaction or it ages out cookies after 7 days)

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SessionKeeper() {
  const lastRefresh = useRef(0);

  useEffect(() => {
    const supabase = createClient();

    async function refresh(force = false) {
      try {
        // Debounce: don't hammer Supabase if multiple events fire quickly
        const now = Date.now();
        if (!force && now - lastRefresh.current < 30_000) return;
        lastRefresh.current = now;

        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;

        // Always force a refresh on resume — keeps the iOS cookie ITP-fresh
        // even when the access token has 30 min left. This is the key fix for
        // "PWA keeps signing me out": Safari WebKit clears cookies after 7d
        // unless the site has user interaction. Refreshing the token on every
        // resume counts as interaction.
        const expiresAt = session.expires_at ?? 0;
        const nowSec = Math.floor(now / 1000);
        if (force || expiresAt - nowSec < 600) {
          await supabase.auth.refreshSession();
        }
      } catch {
        // silent
      }
    }

    // On mount — force refresh
    refresh(true);

    // When tab becomes visible (PWA resumed after iOS backgrounded it)
    function onVisibility() {
      if (document.visibilityState === "visible") refresh(true);
    }
    document.addEventListener("visibilitychange", onVisibility);

    // On window focus
    window.addEventListener("focus", () => refresh(true));

    // Periodic refresh while open: every 30 minutes
    const interval = setInterval(() => refresh(false), 30 * 60 * 1000);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", () => refresh(true));
      clearInterval(interval);
    };
  }, []);

  return null;
}

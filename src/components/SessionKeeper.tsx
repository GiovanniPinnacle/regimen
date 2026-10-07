"use client";

// Keeps the auth session fresh on iOS PWA + desktop, and registers the
// service worker (offline fallback + static caching + push).
//
// - Refreshes session on mount
// - Refreshes when the tab/PWA becomes visible after backgrounding
// - Refreshes on window focus
// - Forces a refresh every time the PWA resumes (iOS Safari ITP needs
//   frequent first-party interaction or it ages out cookies after 7 days)
//
// Resume usually fires BOTH visibilitychange and focus within a few ms.
// Supabase refresh tokens are single-use, so two back-to-back
// refreshSession() calls race: the loser presents an already-consumed
// token and can drop the session. Hence: one in-flight refresh at a
// time, and a debounce that applies to forced refreshes too (only the
// mount refresh skips it).

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { registerServiceWorker } from "@/lib/push";

const DEBOUNCE_MS = 30_000;
const REFRESH_IF_EXPIRES_WITHIN_S = 600;

export default function SessionKeeper() {
  const lastRefresh = useRef(0);
  const inFlight = useRef<Promise<void> | null>(null);

  useEffect(() => {
    const supabase = createClient();

    function refresh({ force = false, skipDebounce = false } = {}) {
      if (inFlight.current) return inFlight.current;
      const now = Date.now();
      if (!skipDebounce && now - lastRefresh.current < DEBOUNCE_MS) return;
      lastRefresh.current = now;

      inFlight.current = (async () => {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (!session) return;

          // Force a refresh on resume — keeps the iOS cookie ITP-fresh
          // even when the access token has 30 min left. Otherwise only
          // refresh when the token is close to expiry.
          const expiresAt = session.expires_at ?? 0;
          const nowSec = Math.floor(Date.now() / 1000);
          if (force || expiresAt - nowSec < REFRESH_IF_EXPIRES_WITHIN_S) {
            await supabase.auth.refreshSession();
          }
        } catch {
          // silent — next trigger retries
        } finally {
          inFlight.current = null;
        }
      })();
      return inFlight.current;
    }

    // On mount — force refresh, no debounce.
    void refresh({ force: true, skipDebounce: true });

    // When tab becomes visible (PWA resumed after iOS backgrounded it)
    function onVisibility() {
      if (document.visibilityState === "visible") void refresh({ force: true });
    }
    // Same function reference for add + remove (an inline arrow in
    // removeEventListener never matches, which leaked a listener per mount).
    function onFocus() {
      void refresh({ force: true });
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);

    // Periodic refresh while open: every 30 minutes (expiry-gated).
    const interval = setInterval(() => void refresh(), 30 * 60 * 1000);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      clearInterval(interval);
    };
  }, []);

  // Register the service worker app-wide (previously only when the user
  // enabled push), so the offline fallback + static cache work for
  // everyone. Deferred to window load so it never competes with first
  // paint. Skipped in dev: a caching SW fights HMR.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    const register = () => void registerServiceWorker();
    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}

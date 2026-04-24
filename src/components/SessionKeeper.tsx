"use client";

// Keeps the auth session fresh on iOS PWA + desktop.
// - Refreshes session on mount
// - Refreshes when the tab/PWA becomes visible after backgrounding
// - Refreshes on window focus

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SessionKeeper() {
  useEffect(() => {
    const supabase = createClient();

    async function refresh() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;
        // Proactively refresh if the access token expires within 5 minutes
        const expiresAt = session.expires_at ?? 0;
        const nowSec = Math.floor(Date.now() / 1000);
        if (expiresAt - nowSec < 300) {
          await supabase.auth.refreshSession();
        }
      } catch {
        // silent
      }
    }

    // On mount
    refresh();

    // When tab becomes visible (e.g. PWA resumed after iOS backgrounded it)
    function onVisibility() {
      if (document.visibilityState === "visible") refresh();
    }
    document.addEventListener("visibilitychange", onVisibility);

    // On window focus
    window.addEventListener("focus", refresh);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  return null;
}

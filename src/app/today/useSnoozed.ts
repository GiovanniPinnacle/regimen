"use client";

// Snoozed item ids (localStorage, see lib/snooze.ts). Re-evaluates every
// minute so expired snoozes reappear, and instantly on the
// `regimen:snooze-changed` event that snoozeItem/clearSnooze fire.

import { useEffect, useMemo, useState } from "react";
import { snoozeExpiry } from "@/lib/snooze";

export function useSnoozed(itemIds: string[]): Set<string> {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    const t = setInterval(bump, 60_000);
    window.addEventListener("regimen:snooze-changed", bump);
    return () => {
      clearInterval(t);
      window.removeEventListener("regimen:snooze-changed", bump);
    };
  }, []);

  const key = itemIds.join(",");
  return useMemo(() => {
    const ids = new Set<string>();
    if (typeof window === "undefined") return ids;
    for (const id of key ? key.split(",") : []) {
      if (snoozeExpiry(id) != null) ids.add(id);
    }
    return ids;
    // tick forces a re-read each minute / on snooze events.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);
}

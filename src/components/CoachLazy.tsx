"use client";

// Coach is the heaviest single component in the app (~1600 lines plus
// CoachMarkdown and the conversation state machine). This wrapper is
// the only thing mounted in the root layout: a tiny listener for the
// `regimen:ask` event (see src/lib/coach-events.ts). The Coach chunk is
// fetched on the FIRST event only; that event's payload is handed to
// Coach as `initialAsk` so it can be replayed once Coach's own listener
// exists. After that Coach listens directly and this wrapper is inert.

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { COACH_EVENT, type CoachAskDetail } from "@/lib/coach-events";

const Coach = dynamic(() => import("@/components/Coach"), {
  ssr: false,
});

export default function CoachLazy() {
  const [first, setFirst] = useState<CoachAskDetail | null>(null);

  useEffect(() => {
    if (first) return;
    function onAsk(e: Event) {
      setFirst((e as CustomEvent<CoachAskDetail>).detail ?? {});
    }
    window.addEventListener(COACH_EVENT, onAsk);
    return () => window.removeEventListener(COACH_EVENT, onAsk);
  }, [first]);

  if (!first) return null;
  return <Coach initialAsk={first} />;
}

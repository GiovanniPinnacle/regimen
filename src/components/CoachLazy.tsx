"use client";

// Coach is the heaviest single component in the app — 1640 lines, plus
// CoachMarkdown, plus the full claude conversation state machine. It's
// rendered in the root layout, so without lazy-loading every page paid
// the cost on first paint, even pages where the user never opens
// Coach.
//
// Strategy: dynamic-import on the client only. ssr:false drops it from
// the SSR HTML entirely — safe because Coach is hidden by default
// (`open === false`) and only opened via window.dispatchEvent. The
// drawer doesn't render anything visible until that event fires.
//
// Result: ~200KB+ off the initial JS bundle on every route. Coach
// code only loads on the client when the user actually engages.

import dynamic from "next/dynamic";

const Coach = dynamic(() => import("@/components/Coach"), {
  ssr: false,
});

export default function CoachLazy() {
  return <Coach />;
}

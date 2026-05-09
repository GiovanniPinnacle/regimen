"use client";

// FeedbackFab + MoreFab — both are persistent floating buttons in the
// root layout. Combined ~330 lines. Neither is critical for first
// paint (FeedbackFab is the small "Feedback" pill, MoreFab is the
// gear icon top-right), so dynamic-import drops them from the SSR
// HTML and out of the initial JS chunk for every route.

import dynamic from "next/dynamic";

const FeedbackFab = dynamic(() => import("@/components/FeedbackFab"), {
  ssr: false,
});

const MoreFab = dynamic(() => import("@/components/MoreFab"), {
  ssr: false,
});

export default function FabsLazy() {
  return (
    <>
      <FeedbackFab />
      <MoreFab />
    </>
  );
}

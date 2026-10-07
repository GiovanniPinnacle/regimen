// Shared skeleton scaffold used by every loading.tsx sibling. Renders
// during SSR/hydration so users don't see a blank flash on every nav.
//
// Pattern: header silhouette (tab title + subtitle + CTA) + a stack
// of card-shaped placeholders. Sized to match what the page renders
// post-load; the swap should feel like a fade-in, not a layout shift.

import { SkeletonLine, SkeletonItemList } from "@/components/Skeleton";

type Props = {
  /** Title text — rendered at low opacity so screen readers get the
   *  context but the text is dim until the real page loads. */
  title?: string;
  /** Number of skeleton item cards under the header. Tune per page. */
  rows?: number;
  /** Whether to render a hero CTA placeholder (Stack / Fuel / Train
   *  full-width button). */
  hero?: boolean;
};

export default function PageSkeleton({
  title,
  rows = 5,
  hero = false,
}: Props) {
  return (
    <div className="pb-24" aria-busy="true">
      <header className="mb-4">
        <div
          className={`text-display opacity-30 ${
            title ? "text-[var(--foreground)]" : "text-transparent"
          }`}
        >
          {title ?? "—"}
        </div>
        <div className="mt-2">
          <SkeletonLine width="62%" height={13} />
        </div>
        {hero && (
          <div className="mt-3">
            <div className="h-12 w-full rounded-[14px] bg-[var(--surface-alt)] opacity-70" />
          </div>
        )}
      </header>
      <SkeletonItemList count={rows} />
    </div>
  );
}

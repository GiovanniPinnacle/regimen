// Skeleton loader primitives — replaces "Loading…" text with proper shimmer
// blocks. Use the building blocks (SkeletonLine, SkeletonCard, etc.) to
// compose realistic placeholders for whatever's loading.

import type { CSSProperties } from "react";

type Size = number | string;

function sizeStyle(width?: Size, height?: Size): CSSProperties {
  return {
    width: typeof width === "number" ? `${width}px` : width,
    height: typeof height === "number" ? `${height}px` : height,
  };
}

export function SkeletonLine({
  width,
  height = "0.9em",
  className = "",
}: {
  width?: Size;
  height?: Size;
  className?: string;
}) {
  return (
    <span
      className={`skeleton skeleton-text ${className}`}
      style={sizeStyle(width, height)}
      aria-hidden
    />
  );
}

export function SkeletonPill({
  width = 60,
  height = 20,
  className = "",
}: {
  width?: Size;
  height?: Size;
  className?: string;
}) {
  return (
    <span
      className={`skeleton skeleton-pill ${className}`}
      style={sizeStyle(width, height)}
      aria-hidden
    />
  );
}

export function SkeletonCard({
  height = 64,
  className = "",
}: {
  height?: Size;
  className?: string;
}) {
  return (
    <div
      className={`skeleton skeleton-card ${className}`}
      style={sizeStyle("100%", height)}
      aria-hidden
    />
  );
}

/** Skeleton stand-in for an item card — matches ItemCard shape on /today + /stack. */
export function SkeletonItemCard() {
  return (
    <div
      className="rounded-xl p-3 flex items-start gap-3"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <span
        className="skeleton skeleton-pill shrink-0 mt-0.5"
        style={{ width: 24, height: 24 }}
        aria-hidden
      />
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <SkeletonLine width="60%" height={14} />
        <SkeletonLine width="40%" height={11} />
      </div>
    </div>
  );
}

/** A list of skeleton item cards — pass count to control density. */
export function SkeletonItemList({ count = 4 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonItemCard key={i} />
      ))}
    </div>
  );
}

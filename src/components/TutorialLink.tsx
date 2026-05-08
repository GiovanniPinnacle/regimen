"use client";

// TutorialLink — renders a "Watch how" / "How to" affordance for any
// item that has media_url and/or how_to set. Used on item detail
// page, /train program cards, and (compact) on ItemCard for any
// active practice with a tutorial.
//
// Three render modes:
//   - "row"   — full button + how_to text below (item detail)
//   - "chip"  — tiny "▶ Watch how" pill (ItemCard, /train cards)
//   - "block" — block button only, no description (slot section)

import Icon from "@/components/Icon";

type Props = {
  mediaUrl: string | null | undefined;
  howTo: string | null | undefined;
  variant?: "row" | "chip" | "block";
  /** Override label. Default infers from URL — "Watch tutorial" for
   *  YouTube, "Read how" for blog/article links. */
  label?: string;
};

function detectKind(url: string): "video" | "article" {
  const lower = url.toLowerCase();
  if (
    lower.includes("youtube.com") ||
    lower.includes("youtu.be") ||
    lower.includes("vimeo.com") ||
    lower.includes("loom.com") ||
    lower.endsWith(".mp4")
  ) {
    return "video";
  }
  return "article";
}

function defaultLabel(url: string | null | undefined): string {
  if (!url) return "How to";
  return detectKind(url) === "video" ? "Watch how" : "Read how";
}

export default function TutorialLink({
  mediaUrl,
  howTo,
  variant = "chip",
  label,
}: Props) {
  if (!mediaUrl && !howTo) return null;
  const resolvedLabel = label ?? defaultLabel(mediaUrl);
  const kind = mediaUrl ? detectKind(mediaUrl) : null;

  if (variant === "chip") {
    if (!mediaUrl) return null;
    return (
      <a
        href={mediaUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1 text-[11.5px] px-2 py-1 rounded-full"
        style={{
          background: "var(--surface-alt)",
          color: "var(--accent)",
          border: "1px solid var(--border)",
          fontWeight: 600,
        }}
      >
        <span aria-hidden>{kind === "video" ? "▶" : "📖"}</span>
        <span>{resolvedLabel}</span>
      </a>
    );
  }

  if (variant === "block") {
    if (!mediaUrl) return null;
    return (
      <a
        href={mediaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-[12.5px] px-3 py-2 rounded-lg"
        style={{
          background: "var(--accent-tint)",
          color: "var(--accent)",
          border: "1px solid var(--border)",
          fontWeight: 700,
          minHeight: 36,
        }}
      >
        <Icon name="external" size={12} strokeWidth={2.2} />
        {resolvedLabel}
      </a>
    );
  }

  // "row" — for item detail. Full breakdown.
  return (
    <div
      className="rounded-2xl card-glass p-4"
      style={{ borderLeft: "3px solid var(--accent)" }}
    >
      <div
        className="text-[10px] uppercase tracking-wider mb-1.5"
        style={{
          color: "var(--accent)",
          fontWeight: 700,
          letterSpacing: "0.08em",
        }}
      >
        How to do this
      </div>
      {howTo && (
        <div
          className="text-[13px] leading-relaxed mb-3"
          style={{ color: "var(--foreground)", opacity: 0.92 }}
        >
          {howTo}
        </div>
      )}
      {mediaUrl && (
        <a
          href={mediaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[13px] px-3.5 py-2 rounded-lg"
          style={{
            background: "var(--accent)",
            color: "#FFFFFF",
            fontWeight: 700,
            minHeight: 36,
          }}
        >
          <Icon name="external" size={12} strokeWidth={2.2} />
          {resolvedLabel}
        </a>
      )}
    </div>
  );
}

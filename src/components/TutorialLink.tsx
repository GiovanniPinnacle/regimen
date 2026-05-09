"use client";

// TutorialLink — renders a "Watch how" / "How to" affordance for any
// item that has media_url and/or how_to set. Used on item detail
// page, /train program cards, and (compact) on ItemCard for any
// active practice with a tutorial.
//
// Three render modes:
//   - "row"   — full how-to block + native inline embed (item detail).
//               Video plays IN-APP, no external bounce.
//   - "chip"  — tiny "▶ Watch how" pill (ItemCard, /train cards).
//               Still opens externally — chip is too small for an embed.
//   - "block" — block button only, no description (slot section).
//
// When mediaUrl is missing but the row variant is requested, we render
// a "Search YouTube for this practice" fallback so the user always has
// an action — never just a dead "no tutorial" state.

import Icon from "@/components/Icon";
import MediaEmbed from "@/components/MediaEmbed";
import { youtubeSearchUrl } from "@/lib/tutorials/curated";

type Props = {
  mediaUrl: string | null | undefined;
  howTo: string | null | undefined;
  variant?: "row" | "chip" | "block";
  /** Override label. Default infers from URL — "Watch tutorial" for
   *  YouTube, "Read how" for blog/article links. */
  label?: string;
  /** Item name — used to build the YouTube-search fallback when
   *  mediaUrl is missing. Required for the row variant when there's
   *  no URL. */
  itemName?: string;
  /** Optional source attribution shown under the embed
   *  ("Andrew Huberman", "Jeff Nippard", etc.). */
  source?: string;
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
  itemName,
  source,
}: Props) {
  if (!mediaUrl && !howTo && !itemName) return null;
  const resolvedLabel = label ?? defaultLabel(mediaUrl);
  const kind = mediaUrl ? detectKind(mediaUrl) : null;

  // === CHIP — compact ItemCard pill ===
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

  // === BLOCK — slot-section button ===
  if (variant === "block") {
    if (!mediaUrl) return null;
    return (
      <a
        href={mediaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-[12.5px] px-3 py-2 rounded-lg no-truncate"
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

  // === ROW — item detail. Native embed + how-to text + fallback. ===
  return (
    <div className="flex flex-col gap-3">
      {howTo && (
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
          <div
            className="text-[13.5px] leading-relaxed"
            style={{ color: "var(--foreground)", opacity: 0.92 }}
          >
            {howTo}
          </div>
        </div>
      )}

      {mediaUrl ? (
        // Native inline embed — plays in-app for YouTube/Vimeo, falls
        // back to a polished outbound card for other hosts.
        <MediaEmbed url={mediaUrl} source={source} />
      ) : itemName ? (
        // No tutorial URL — give the user a one-tap fallback to find
        // their own. Better than a dead end.
        <a
          href={youtubeSearchUrl(itemName)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-2xl p-4 flex items-center justify-between gap-3"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div className="min-w-0">
            <div
              className="text-[10px] uppercase tracking-wider"
              style={{
                color: "var(--muted)",
                fontWeight: 700,
                letterSpacing: "0.08em",
              }}
            >
              No tutorial saved yet
            </div>
            <div
              className="text-[13.5px] mt-1"
              style={{ color: "var(--foreground)", fontWeight: 600 }}
            >
              Search YouTube for &ldquo;{itemName}&rdquo;
            </div>
          </div>
          <span
            className="shrink-0 h-9 w-9 rounded-xl flex items-center justify-center"
            style={{
              background: "var(--accent-tint)",
              color: "var(--accent)",
            }}
          >
            <Icon name="search" size={14} strokeWidth={2.2} />
          </span>
        </a>
      ) : null}
    </div>
  );
}

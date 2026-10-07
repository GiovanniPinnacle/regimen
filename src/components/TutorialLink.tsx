"use client";

// TutorialLink — renders a "Watch how" / "How to" affordance for any
// item that has media_url and/or how_to set. Used on item detail
// page, /train program cards, and (compact) on ItemCard for any
// active practice with a tutorial.
//
// Three render modes:
//   - "row"   — full how-to block + native inline embed (item detail).
//               Video plays IN-APP, no external bounce.
//   - "chip"  — small "Watch how" pill (ItemCard, /train cards).
//               Still opens externally — chip is too small for an embed.
//   - "block" — block button only, no description (slot section).
//
// When mediaUrl is missing but the row variant is requested, we render
// a "Search YouTube for this practice" fallback so the user always has
// an action — never just a dead "no tutorial" state.

import Icon from "@/components/Icon";
import { buttonClass } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { Eyebrow } from "@/components/ui/Section";
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
        className="relative inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-alt)] px-3 text-caption font-semibold text-[var(--foreground)] before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-['']"
      >
        <Icon name={kind === "video" ? "play" : "book"} size={13} strokeWidth={2} />
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
        className={buttonClass({ variant: "secondary", size: "md", className: "no-truncate" })}
      >
        <Icon name={kind === "video" ? "play" : "external"} size={16} strokeWidth={1.9} />
        {resolvedLabel}
      </a>
    );
  }

  // === ROW — item detail. Native embed + how-to text + fallback. ===
  return (
    <div className="flex flex-col gap-3">
      {howTo && (
        <div className={cardClass({ padding: "md" })}>
          <Eyebrow className="mb-1.5">How to do this</Eyebrow>
          <p className="text-callout leading-relaxed text-[var(--foreground-soft)] whitespace-pre-line">
            {howTo}
          </p>
        </div>
      )}

      {mediaUrl ? (
        // Native inline embed — plays in-app for YouTube/Vimeo, falls
        // back to a polished outbound card for other hosts. searchTerm
        // is what we offer if the video is dead at view-time.
        <MediaEmbed
          url={mediaUrl}
          source={source}
          searchTerm={itemName}
        />
      ) : itemName ? (
        // No tutorial URL — give the user a one-tap fallback to find
        // their own. Better than a dead end.
        <a
          href={youtubeSearchUrl(itemName)}
          target="_blank"
          rel="noopener noreferrer"
          className={cardClass({
            padding: "md",
            interactive: true,
            className: "flex items-center justify-between gap-3",
          })}
        >
          <div className="min-w-0">
            <Eyebrow>No tutorial saved yet</Eyebrow>
            <div className="mt-1 text-callout font-semibold text-[var(--foreground)]">
              Search YouTube for &ldquo;{itemName}&rdquo;
            </div>
          </div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--surface-alt)] text-[var(--foreground-soft)]">
            <Icon name="search" size={16} strokeWidth={2} />
          </span>
        </a>
      ) : null}
    </div>
  );
}

"use client";

// MediaEmbed — renders a tutorial video INLINE in the app instead of
// kicking the user out to YouTube. Use this on item detail pages, /train
// program cards, or anywhere a how-to video belongs.
//
// Strategy:
//   1. YouTube + Vimeo URLs → native iframe embed at 16:9 aspect ratio
//      (CSP allow-list in next.config.ts permits both)
//   2. Other URLs → polished outbound card with the source name
//   3. No URL → null (caller falls back to TutorialLink/SearchFallback)
//
// "Privacy-enhanced" embed for YouTube uses youtube-nocookie.com so we
// don't drop tracking cookies on users who never asked for that.

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { cardClass } from "@/components/ui/Card";
import { Eyebrow } from "@/components/ui/Section";
import { youtubeSearchUrl } from "@/lib/tutorials/curated";

type Props = {
  url: string;
  /** Optional source label for the byline ("Andrew Huberman", etc.). */
  source?: string;
  /** Lazy: only mount the iframe after the user taps. Saves bandwidth +
   *  YouTube's tracking pings. Default true. */
  lazy?: boolean;
  /** Search-fallback target — passed to the "video unavailable" state
   *  so we can offer "Search YouTube for {item}" instead of a dead end.
   *  Falls back to the URL's hostname if not provided. */
  searchTerm?: string;
};

const YT_RX =
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{8,})/;
const VIMEO_RX = /vimeo\.com\/(?:video\/)?(\d+)/;

function parseYouTubeId(url: string): string | null {
  const m = url.match(YT_RX);
  return m?.[1] ?? null;
}

function parseVimeoId(url: string): string | null {
  const m = url.match(VIMEO_RX);
  return m?.[1] ?? null;
}

export default function MediaEmbed({
  url,
  source,
  lazy = true,
  searchTerm,
}: Props) {
  const ytId = parseYouTubeId(url);
  const vimeoId = parseVimeoId(url);
  const [active, setActive] = useState(!lazy);
  const [thumbBroken, setThumbBroken] = useState(false);
  const [oembedDead, setOembedDead] = useState(false);

  // YouTube doesn't fire onError on iframe even for deleted videos —
  // the iframe just shows YouTube's "Video unavailable" page. Hit
  // oEmbed once on mount to detect deletion BEFORE the user taps
  // play. Same check the cron uses; cached aggressively by YouTube.
  useEffect(() => {
    if (!ytId) return;
    let alive = true;
    fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
    )
      .then((res) => {
        if (!alive) return;
        if (res.status !== 200) setOembedDead(true);
      })
      .catch(() => {
        // Network error — don't show the fallback (might be a transient
        // user-side connectivity issue, not a dead video).
      });
    return () => {
      alive = false;
    };
  }, [ytId, url]);

  // Dead-video fallback: search button styled like the embed card.
  if ((ytId || vimeoId) && oembedDead) {
    return (
      <a
        href={searchTerm ? youtubeSearchUrl(searchTerm) : url}
        target="_blank"
        rel="noopener noreferrer"
        className={cardClass({
          padding: "md",
          interactive: true,
          className: "block border-dashed border-[var(--border-strong)]",
        })}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1 text-eyebrow uppercase text-[var(--warn)]">
              <Icon name="alert" size={12} strokeWidth={2} />
              Video no longer available
            </div>
            <div className="mt-1 text-callout font-semibold text-[var(--foreground)]">
              {searchTerm
                ? `Search YouTube for "${searchTerm}"`
                : "Open original link"}
            </div>
          </div>
          <TrailingTile icon="search" />
        </div>
      </a>
    );
  }

  // === YouTube — privacy-enhanced embed ===
  if (ytId) {
    const embedSrc = `https://www.youtube-nocookie.com/embed/${ytId}?rel=0&modestbranding=1`;
    const thumb = `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
    return (
      <div className={cardClass({ padding: "none", className: "overflow-hidden" })}>
        <div className="relative aspect-video w-full bg-[var(--background)]">
          {active ? (
            <iframe
              src={embedSrc}
              title="Tutorial"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            />
          ) : (
            <button
              type="button"
              onClick={() => setActive(true)}
              className="group absolute inset-0 flex h-full w-full items-center justify-center bg-[var(--surface-alt)] bg-cover bg-center"
              aria-label="Play tutorial"
              style={thumbBroken ? undefined : { backgroundImage: `url(${thumb})` }}
            >
              {/* Hidden img tag fires onError if YouTube serves a
                  blank/missing thumb — flip to the plain surface. */}
              <img
                src={thumb}
                alt=""
                className="hidden"
                onError={() => setThumbBroken(true)}
              />
              {!thumbBroken && (
                <span aria-hidden className="absolute inset-0 bg-black/30" />
              )}
              <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-fg)] shadow-[var(--shadow-lift)] transition-transform group-active:scale-95">
                <Icon name="play" size={22} strokeWidth={2} className="ml-0.5" />
              </span>
            </button>
          )}
        </div>
        {source && (
          <div className="flex min-h-[44px] items-center justify-between gap-3 px-4 text-caption text-[var(--muted)]">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <Icon name="play" size={12} strokeWidth={2} />
              <span className="truncate font-semibold text-[var(--foreground-soft)]">{source}</span>
            </span>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] shrink-0 items-center gap-1 font-medium text-[var(--foreground-soft)]"
            >
              Open on YouTube
              <Icon name="external" size={12} strokeWidth={2} />
            </a>
          </div>
        )}
      </div>
    );
  }

  // === Vimeo ===
  if (vimeoId) {
    return (
      <div className={cardClass({ padding: "none", className: "overflow-hidden" })}>
        <div className="relative aspect-video w-full bg-[var(--background)]">
          <iframe
            src={`https://player.vimeo.com/video/${vimeoId}?title=0&byline=0&portrait=0`}
            title="Tutorial"
            loading="lazy"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full border-0"
          />
        </div>
        {source && (
          <div className="px-4 py-3 text-caption font-semibold text-[var(--muted)]">
            {source} · Vimeo
          </div>
        )}
      </div>
    );
  }

  // === Generic outbound link card ===
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cardClass({ padding: "md", interactive: true, className: "block" })}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <Eyebrow>{source ? `Read on ${source}` : "External tutorial"}</Eyebrow>
          <div className="mt-1 truncate text-callout font-semibold text-[var(--foreground)]">
            {new URL(url).hostname.replace(/^www\./, "")}
          </div>
        </div>
        <TrailingTile icon="external" />
      </div>
    </a>
  );
}

function TrailingTile({ icon }: { icon: "search" | "external" }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--surface-alt)] text-[var(--foreground-soft)]">
      <Icon name={icon} size={16} strokeWidth={2} />
    </span>
  );
}

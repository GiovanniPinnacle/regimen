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
        className="block rounded-2xl p-4"
        style={{
          background: "var(--surface)",
          border: "1px dashed var(--border-strong)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div
              className="text-[10px] uppercase tracking-wider"
              style={{
                color: "var(--warn)",
                fontWeight: 700,
                letterSpacing: "0.08em",
              }}
            >
              Video no longer available
            </div>
            <div
              className="text-[13.5px] mt-1"
              style={{ color: "var(--foreground)", fontWeight: 600 }}
            >
              {searchTerm
                ? `Search YouTube for "${searchTerm}"`
                : "Open original link"}
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
        </div>
      </a>
    );
  }

  // === YouTube — privacy-enhanced embed ===
  if (ytId) {
    const embedSrc = `https://www.youtube-nocookie.com/embed/${ytId}?rel=0&modestbranding=1`;
    const thumb = `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
    return (
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div
          className="relative w-full"
          style={{ aspectRatio: "16 / 9", background: "#000" }}
        >
          {active ? (
            <iframe
              src={embedSrc}
              title="Tutorial"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
              style={{ border: 0 }}
            />
          ) : (
            <button
              onClick={() => setActive(true)}
              className="absolute inset-0 w-full h-full flex items-center justify-center"
              aria-label="Play tutorial"
              style={{
                backgroundImage: thumbBroken ? "none" : `url(${thumb})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                background: thumbBroken
                  ? "linear-gradient(135deg, rgba(0, 214, 128, 0.10) 0%, rgba(139, 124, 252, 0.10) 100%)"
                  : undefined,
              }}
            >
              {/* Hidden img tag fires onError if YouTube serves a
                  blank/missing thumb — flip to gradient fallback. */}
              <img
                src={thumb}
                alt=""
                className="hidden"
                onError={() => setThumbBroken(true)}
              />
              <span
                className="absolute inset-0"
                style={{
                  background: thumbBroken
                    ? "transparent"
                    : "linear-gradient(180deg, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.55) 100%)",
                }}
              />
              <span
                className="relative h-14 w-14 rounded-full flex items-center justify-center"
                style={{
                  background: "rgba(0, 0, 0, 0.78)",
                  color: "#FFFFFF",
                  boxShadow:
                    "0 12px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.18)",
                }}
              >
                {/* Inline play triangle — avoids depending on the
                    shared Icon set since "play" isn't in it. */}
                <svg
                  viewBox="0 0 24 24"
                  width="22"
                  height="22"
                  fill="currentColor"
                  aria-hidden
                  style={{ marginLeft: 2 }}
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
            </button>
          )}
        </div>
        {source && (
          <div
            className="px-3.5 py-2.5 flex items-center justify-between text-[11.5px]"
            style={{ color: "var(--muted)" }}
          >
            <span className="inline-flex items-center gap-1.5">
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 3,
                  background: "#FF0000",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#FFFFFF",
                  fontSize: 9,
                  fontWeight: 700,
                  lineHeight: 1,
                }}
              >
                ▶
              </span>
              <span style={{ fontWeight: 600 }}>{source}</span>
            </span>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1"
              style={{ color: "var(--muted)" }}
            >
              Open on YouTube
              <Icon name="external" size={10} strokeWidth={2.2} />
            </a>
          </div>
        )}
      </div>
    );
  }

  // === Vimeo ===
  if (vimeoId) {
    return (
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
          <iframe
            src={`https://player.vimeo.com/video/${vimeoId}?title=0&byline=0&portrait=0`}
            title="Tutorial"
            loading="lazy"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
            style={{ border: 0 }}
          />
        </div>
        {source && (
          <div
            className="px-3.5 py-2.5 text-[11.5px]"
            style={{ color: "var(--muted)", fontWeight: 600 }}
          >
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
      className="block rounded-2xl p-4"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div
            className="text-[10px] uppercase tracking-wider"
            style={{
              color: "var(--muted)",
              fontWeight: 700,
              letterSpacing: "0.08em",
            }}
          >
            {source ? `Read on ${source}` : "External tutorial"}
          </div>
          <div
            className="text-[13px] mt-1 truncate"
            style={{ color: "var(--foreground)", fontWeight: 600 }}
          >
            {new URL(url).hostname.replace(/^www\./, "")}
          </div>
        </div>
        <span
          className="shrink-0 h-9 w-9 rounded-xl flex items-center justify-center"
          style={{
            background: "var(--accent-tint)",
            color: "var(--accent)",
          }}
        >
          <Icon name="external" size={14} strokeWidth={2.2} />
        </span>
      </div>
    </a>
  );
}

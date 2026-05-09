// EmptyGlyph — large icon in a tinted accent block, used for empty
// states across the app. Premium apps don't say "no data" with
// plain text; they pair the message with a visual that signals
// "this surface has a purpose, fill it." This is that visual.
//
// Sizing pattern: 64px outer block (rounded 18px) with a 28-32px
// icon inside. Tinted background uses the matching accent at low
// alpha so the glyph reads as a soft lift, not a hard color block.

import type { ComponentProps } from "react";
import Icon from "@/components/Icon";

type IconName = ComponentProps<typeof Icon>["name"];

type Tone = "accent" | "pro" | "premium" | "muted" | "warn";

const TONE_MAP: Record<Tone, { bg: string; color: string }> = {
  accent: { bg: "var(--accent-tint)", color: "var(--accent)" },
  pro: { bg: "var(--pro-tint)", color: "var(--pro)" },
  premium: { bg: "var(--premium-tint)", color: "var(--premium)" },
  muted: {
    bg: "var(--surface-alt)",
    color: "var(--foreground-soft)",
  },
  warn: {
    bg: "rgba(232, 181, 71, 0.10)",
    color: "var(--warn)",
  },
};

type Props = {
  /** Icon name from the shared Icon set. */
  icon: IconName;
  /** Color family — picks the tinted background + icon color. */
  tone?: Tone;
  /** Pixel size of the outer block. Icon scales to ~50% of this. */
  size?: number;
};

export default function EmptyGlyph({
  icon,
  tone = "accent",
  size = 64,
}: Props) {
  const { bg, color } = TONE_MAP[tone];
  const iconSize = Math.round(size * 0.45);
  return (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        background: bg,
        color,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.04)",
      }}
    >
      <Icon name={icon} size={iconSize} strokeWidth={1.7} />
    </div>
  );
}

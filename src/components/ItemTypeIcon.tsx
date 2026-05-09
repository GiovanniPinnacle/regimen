// ItemTypeIcon — renders the item type as a tinted-block vector icon
// matching the EmptyGlyph aesthetic. Replaces the emoji 💊🧴📟🏥🧘🥑🛏🧪
// pattern from v2 with line-art icons consistent with the rest of the
// app.
//
// Sizing pattern: 28-36px outer block (rounded 10px) with a 14-18px
// icon inside. Tinted background uses --surface-alt by default so the
// icon doesn't compete with the item content next to it; pass `tone`
// for accent-colored variants.

import Icon from "@/components/Icon";
import { ITEM_TYPE_ICON_NAME } from "@/lib/constants";
import type { ItemType } from "@/lib/types";

type Tone = "neutral" | "accent" | "pro" | "premium";

const TONE_BG: Record<Tone, string> = {
  neutral: "var(--surface-alt)",
  accent: "var(--accent-tint)",
  pro: "var(--pro-tint)",
  premium: "var(--premium-tint)",
};

const TONE_FG: Record<Tone, string> = {
  neutral: "var(--foreground-soft)",
  accent: "var(--accent)",
  pro: "var(--pro)",
  premium: "var(--premium)",
};

type Props = {
  type: ItemType;
  /** Pixel size of the outer block. Defaults to 28 (compact card chip). */
  size?: number;
  /** Tinted background tone. Defaults to neutral. */
  tone?: Tone;
};

export default function ItemTypeIcon({
  type,
  size = 28,
  tone = "neutral",
}: Props) {
  const iconName = ITEM_TYPE_ICON_NAME[type];
  const iconSize = Math.max(12, Math.round(size * 0.55));
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: Math.max(6, Math.round(size * 0.32)),
        background: TONE_BG[tone],
        color: TONE_FG[tone],
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <Icon name={iconName} size={iconSize} strokeWidth={1.7} />
    </span>
  );
}

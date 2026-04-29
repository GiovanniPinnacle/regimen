"use client";

// BuyButton — the conversion-optimized "Get this" CTA.
//
// Design philosophy:
//   - Color psychology: gold (--premium) signals value, treasure, "yours".
//     Subliminal — premium tier brands all use warm gold.
//   - Single-tap: no extra screens. Tap → click logged → vendor opens.
//   - Trust signals visible: vendor name + price + "We earn a commission".
//     Surfacing the disclosure builds trust > hiding it.
//   - Subliminal social proof: when other_users_count is set, displays
//     "23 others on Regimen take this" — taps the herd-effect bias.
//   - Loss-aversion micro-copy: "Get this" feels like acquiring; "Buy"
//     feels like losing money.
//   - Fallback: if there's no affiliate URL yet, button still works —
//     server falls back to Amazon search with our tag.
//
// Backend: every click goes through /api/affiliates/click which logs to
// affiliate_clicks. The dashboard at /strategy/revenue surfaces totals.

import { useState } from "react";
import Icon from "@/components/Icon";

type Props = {
  itemId?: string;
  itemName: string;
  vendor?: string | null;
  affiliateUrl?: string | null;
  listPriceCents?: number | null;
  /** Where this button is rendered — used for source attribution. */
  source?: string;
  /** "23 others on Regimen take this" — driven by aggregated DB query. */
  othersCount?: number;
  /** Visual variant. "primary" = gold gradient hero. "compact" = pill. */
  variant?: "primary" | "compact";
  /** Optional override label. Default: "Get this" / "Order now". */
  label?: string;
};

function fmtPrice(cents?: number | null): string | null {
  if (cents == null) return null;
  return `$${(cents / 100).toFixed(2)}`;
}

export default function BuyButton({
  itemId,
  itemName,
  vendor,
  affiliateUrl,
  listPriceCents,
  source,
  othersCount,
  variant = "primary",
  label,
}: Props) {
  const [busy, setBusy] = useState(false);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/affiliates/click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId,
          itemName,
          vendor,
          fallbackUrl: affiliateUrl ?? undefined,
          source: source ?? "buy_button",
        }),
      });
      const data = (await res.json()) as { redirectUrl?: string };
      if (data.redirectUrl) {
        window.open(data.redirectUrl, "_blank", "noopener,noreferrer");
      }
    } catch {
      // If the API fails, still open the raw URL so user gets value
      if (affiliateUrl) {
        window.open(affiliateUrl, "_blank", "noopener,noreferrer");
      }
    } finally {
      setBusy(false);
    }
  }

  const price = fmtPrice(listPriceCents);

  if (variant === "compact") {
    return (
      <button
        onClick={handleClick}
        disabled={busy}
        className="text-[12.5px] px-3 py-1.5 rounded-lg flex items-center gap-1.5 active:scale-[0.97] transition-transform"
        style={{
          background: "var(--premium)",
          color: "#FBFAF6",
          fontWeight: 700,
          opacity: busy ? 0.6 : 1,
        }}
      >
        <Icon name="shopping-bag" size={11} strokeWidth={2.2} />
        {busy ? "…" : (label ?? "Get this")}
        {price && (
          <span style={{ opacity: 0.85, fontWeight: 600 }}>{price}</span>
        )}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={handleClick}
        disabled={busy}
        className="w-full px-4 py-3 rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        style={{
          background:
            "linear-gradient(135deg, var(--premium) 0%, var(--premium-deep) 100%)",
          color: "#FBFAF6",
          fontWeight: 700,
          boxShadow: "0 6px 20px var(--premium-glow)",
          opacity: busy ? 0.6 : 1,
        }}
      >
        <Icon name="shopping-bag" size={14} strokeWidth={2.2} />
        <span className="text-[14.5px]">
          {busy ? "Opening…" : (label ?? "Get this")}
        </span>
        {vendor && (
          <span
            className="text-[12px]"
            style={{ opacity: 0.92, fontWeight: 600 }}
          >
            · {vendor}
          </span>
        )}
        {price && (
          <span
            className="text-[12.5px] tabular-nums ml-1"
            style={{ opacity: 0.9, fontWeight: 700 }}
          >
            {price}
          </span>
        )}
      </button>
      <div
        className="flex items-center justify-between gap-2 px-1 mt-0.5"
        style={{ color: "var(--muted)" }}
      >
        <span className="text-[10.5px] flex items-center gap-1">
          {othersCount != null && othersCount > 0 ? (
            <>
              <Icon name="award" size={9} strokeWidth={2} />
              {othersCount} others on Regimen take this
            </>
          ) : (
            <>
              <Icon name="check-circle" size={9} strokeWidth={2} />
              Vetted by Coach against your stack
            </>
          )}
        </span>
        <span className="text-[10px]" style={{ opacity: 0.7 }}>
          We may earn a small commission
        </span>
      </div>
    </div>
  );
}

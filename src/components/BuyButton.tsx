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
import { buttonClass } from "@/components/ui/Button";

type Props = {
  itemId?: string;
  itemName: string;
  vendor?: string | null;
  affiliateUrl?: string | null;
  listPriceCents?: number | null;
  /** Catalog-row defaults — used when the user's item has no override.
   *  Keeps the click path consistent across all users sharing a catalog
   *  entry (and lets the FIRST user's discovery work for the 99th). */
  catalogVendor?: string | null;
  catalogAffiliateUrl?: string | null;
  catalogListPriceCents?: number | null;
  /** Where this button is rendered — used for source attribution. */
  source?: string;
  /** "23 others on Regimen take this" — driven by aggregated DB query. */
  othersCount?: number;
  /** Visual variant. "primary" = full-width gold CTA. "compact" = small pill. */
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
  catalogVendor,
  catalogAffiliateUrl,
  catalogListPriceCents,
  source,
  othersCount,
  variant = "primary",
  label,
}: Props) {
  const [busy, setBusy] = useState(false);

  // Resolve effective vendor/url/price by falling back to catalog defaults.
  // The user item's affiliate fields take priority (per-user vendor swap
  // wins), then catalog defaults, then a fallback Amazon search via the
  // server's /api/affiliates/click route.
  const effectiveVendor = vendor ?? catalogVendor ?? null;
  const effectiveUrl = affiliateUrl ?? catalogAffiliateUrl ?? null;
  const effectivePrice = listPriceCents ?? catalogListPriceCents ?? null;

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
          vendor: effectiveVendor,
          fallbackUrl: effectiveUrl ?? undefined,
          source: source ?? "buy_button",
        }),
      });
      const data = (await res.json()) as { redirectUrl?: string };
      if (data.redirectUrl) {
        window.open(data.redirectUrl, "_blank", "noopener,noreferrer");
      }
    } catch {
      // If the API fails, still open the raw URL so user gets value
      if (effectiveUrl) {
        window.open(effectiveUrl, "_blank", "noopener,noreferrer");
      }
    } finally {
      setBusy(false);
    }
  }

  const price = fmtPrice(effectivePrice);

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        aria-busy={busy || undefined}
        className={buttonClass({
          variant: "premium",
          size: "sm",
          className: `relative font-semibold before:absolute before:-inset-y-1 before:inset-x-0 before:content-[''] ${
            busy ? "opacity-60" : ""
          }`,
        })}
      >
        <Icon name="shopping-bag" size={14} strokeWidth={2} />
        <span>{busy ? "Opening…" : (label ?? "Get this")}</span>
        {price && <span className="tabular-nums opacity-80">{price}</span>}
      </button>
    );
  }

  // Primary variant uses effectiveVendor/Price for inline display
  const displayVendor = effectiveVendor;

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        aria-busy={busy || undefined}
        className={buttonClass({
          variant: "premium",
          size: "lg",
          fullWidth: true,
          className: busy ? "opacity-60" : "",
        })}
      >
        <Icon name="shopping-bag" size={18} strokeWidth={1.9} />
        <span>{busy ? "Opening…" : (label ?? "Get this")}</span>
        {displayVendor && (
          <span className="truncate text-callout font-medium opacity-80">
            · {displayVendor}
          </span>
        )}
        {price && (
          <span className="ml-1 text-callout font-semibold tabular-nums opacity-90">
            {price}
          </span>
        )}
      </button>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 px-1 text-caption text-[var(--muted)]">
        <span className="flex items-center gap-1">
          {othersCount != null && othersCount > 0 ? (
            <>
              <Icon name="award" size={12} strokeWidth={2} />
              {othersCount} others on Regimen take this
            </>
          ) : (
            <>
              <Icon name="check-circle" size={12} strokeWidth={2} />
              Vetted by Coach against your stack
            </>
          )}
        </span>
        <span>We may earn a small commission</span>
      </div>
    </div>
  );
}

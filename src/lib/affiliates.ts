// Affiliate-link infrastructure.
//
// Every item Coach surfaces should become a revenue opportunity. This file
// is the single source of truth for:
//   1. Network configs (Amazon Associates tag, iHerb partner, etc.)
//   2. URL builders that wrap raw URLs with tracking parameters
//   3. Known-vendor mapping (so common items auto-resolve to the right
//      affiliate URL without an API call)
//   4. Commission rate estimates for revenue projection
//
// Refinement-first contract: affiliates do NOT influence what Coach
// recommends as primary advice. Coach is told to prefer items with
// affiliate links ONLY when health-equivalent alternatives exist, and
// must always disclose. See contextToSystemPrompt.

export type AffiliateNetwork =
  | "amazon"
  | "iherb"
  | "thorne"
  | "fullscript"
  | "manufacturer"
  | "other";

export type AffiliateConfig = {
  network: AffiliateNetwork;
  label: string;
  /** Estimated commission rate as percent (used for projections only). */
  commissionRate: number;
  /** Tracking param/tag inserted into URLs. Read from env. */
  trackingTagEnvKey: string;
  /** Domain root used to detect existing URLs of this type. */
  domain: string;
  /** Param name used by this network for the tracking tag. */
  trackingParam: string;
};

export const AFFILIATE_CONFIGS: Record<AffiliateNetwork, AffiliateConfig> = {
  amazon: {
    network: "amazon",
    label: "Amazon",
    commissionRate: 4.0,
    trackingTagEnvKey: "AMAZON_ASSOCIATES_TAG",
    domain: "amazon.com",
    trackingParam: "tag",
  },
  iherb: {
    network: "iherb",
    label: "iHerb",
    commissionRate: 5.0,
    trackingTagEnvKey: "IHERB_PARTNER_ID",
    domain: "iherb.com",
    trackingParam: "rcode",
  },
  thorne: {
    network: "thorne",
    label: "Thorne",
    commissionRate: 15.0,
    trackingTagEnvKey: "THORNE_PARTNER_ID",
    domain: "thorne.com",
    trackingParam: "p",
  },
  fullscript: {
    network: "fullscript",
    label: "Fullscript",
    commissionRate: 25.0,
    trackingTagEnvKey: "FULLSCRIPT_PARTNER_ID",
    domain: "fullscript.com",
    trackingParam: "ref",
  },
  manufacturer: {
    network: "manufacturer",
    label: "Direct from brand",
    commissionRate: 10.0,
    trackingTagEnvKey: "MANUFACTURER_GENERIC_TAG",
    domain: "",
    trackingParam: "ref",
  },
  other: {
    network: "other",
    label: "Vendor",
    commissionRate: 5.0,
    trackingTagEnvKey: "GENERIC_AFFILIATE_TAG",
    domain: "",
    trackingParam: "ref",
  },
};

/**
 * Detect which affiliate network a URL belongs to (or null if none).
 */
export function detectNetwork(url: string): AffiliateNetwork | null {
  const u = url.toLowerCase();
  if (u.includes("amazon.com") || u.includes("amzn.to")) return "amazon";
  if (u.includes("iherb.com")) return "iherb";
  if (u.includes("thorne.com")) return "thorne";
  if (u.includes("fullscript.com")) return "fullscript";
  return null;
}

/**
 * Wrap a raw URL with the configured tracking tag. If no tag env var is
 * set, returns the URL unchanged (graceful degradation). Idempotent: if
 * the URL already has the right tag, no double-wrap.
 */
export function wrapWithTrackingTag(
  url: string,
  network: AffiliateNetwork,
): string {
  const cfg = AFFILIATE_CONFIGS[network];
  const tag = process.env[cfg.trackingTagEnvKey];
  if (!tag) return url;
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.get(cfg.trackingParam) === tag) return url;
    parsed.searchParams.set(cfg.trackingParam, tag);
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Quick-look fallback URL for items that don't have a direct affiliate
 * URL yet — sends users to an Amazon search with our tag attached. Used
 * by BuyButton when affiliate_url is null but we want to give the user
 * SOMETHING actionable + still capture commission if they buy.
 */
export function fallbackAmazonSearchUrl(query: string): string {
  const tag = process.env.AMAZON_ASSOCIATES_TAG;
  const q = encodeURIComponent(query);
  if (tag) {
    return `https://www.amazon.com/s?k=${q}&tag=${tag}`;
  }
  return `https://www.amazon.com/s?k=${q}`;
}

/**
 * Estimated commission for a given list price + network. Used for the
 * revenue dashboard's "potential" projection.
 */
export function estimateCommissionCents(
  listPriceCents: number,
  network: AffiliateNetwork,
): number {
  const rate = AFFILIATE_CONFIGS[network].commissionRate / 100;
  return Math.round(listPriceCents * rate);
}

/**
 * Shape returned to client by /api/affiliates/click. The client opens
 * `redirectUrl` in a new tab AFTER logging.
 */
export type ClickLogResult = {
  ok: boolean;
  redirectUrl: string;
  network?: AffiliateNetwork;
};

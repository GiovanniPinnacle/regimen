// /api/affiliates/discover — Coach-powered affiliate URL discovery.
//
// Called automatically after /api/proposals/execute when a new item is
// added (so every new Coach-proposed item becomes a revenue opportunity).
// Also callable manually from the UI for items without a URL.
//
// Strategy:
//   1. Use a known-vendor mapping for common items (Vitamin D, Magnesium,
//      etc.) → fast path, no Coach call
//   2. Fall back to Coach: ask it to suggest the best vendor for the item,
//      given the user's hard NOs and the available networks
//   3. Mark items.affiliate_lookup_status accordingly
//
// Refinement-first contract: this only runs AFTER an item has been
// approved by the user. We don't pre-emptively populate affiliate links
// before the user decides they want the item. Discovery never changes
// user-facing recommendations.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropic, MODELS } from "@/lib/anthropic";
import {
  AFFILIATE_CONFIGS,
  detectNetwork,
  fallbackAmazonSearchUrl,
  wrapWithTrackingTag,
  type AffiliateNetwork,
} from "@/lib/affiliates";

export const runtime = "nodejs";
export const maxDuration = 30;

type Body = { itemId: string };

// Curated fast-path: common items → known good affiliate URLs. Saves a
// Coach call when we already know the answer. URLs are vendor pages,
// wrapped at click-time with our tracking tag.
const KNOWN_VENDOR_MAP: Record<
  string,
  { vendor: string; network: AffiliateNetwork; searchUrl: string }
> = {
  "vitamin d3": {
    vendor: "Thorne",
    network: "thorne",
    searchUrl: "https://www.thorne.com/products/dp/vitamin-d-k2-liquid",
  },
  "vitamin k2": {
    vendor: "Thorne",
    network: "thorne",
    searchUrl: "https://www.thorne.com/products/dp/vitamin-d-k2-liquid",
  },
  magnesium: {
    vendor: "Thorne",
    network: "thorne",
    searchUrl: "https://www.thorne.com/products/dp/magnesium-bisglycinate",
  },
  "fish oil": {
    vendor: "Thorne",
    network: "thorne",
    searchUrl: "https://www.thorne.com/products/dp/super-epa",
  },
  omega: {
    vendor: "Thorne",
    network: "thorne",
    searchUrl: "https://www.thorne.com/products/dp/super-epa",
  },
  creatine: {
    vendor: "Amazon",
    network: "amazon",
    searchUrl: "https://www.amazon.com/s?k=creatine+monohydrate+micronized",
  },
  zinc: {
    vendor: "Thorne",
    network: "thorne",
    searchUrl: "https://www.thorne.com/products/dp/zinc-picolinate-30-mg",
  },
  "vitamin c": {
    vendor: "Amazon",
    network: "amazon",
    searchUrl: "https://www.amazon.com/s?k=liposomal+vitamin+c",
  },
  electrolyte: {
    vendor: "Amazon",
    network: "amazon",
    searchUrl: "https://www.amazon.com/s?k=lmnt+electrolyte",
  },
};

function fastPath(itemName: string): {
  vendor: string;
  network: AffiliateNetwork;
  url: string;
} | null {
  const lower = itemName.toLowerCase();
  for (const key of Object.keys(KNOWN_VENDOR_MAP)) {
    if (lower.includes(key)) {
      const m = KNOWN_VENDOR_MAP[key];
      return { vendor: m.vendor, network: m.network, url: m.searchUrl };
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (!body.itemId) {
    return NextResponse.json({ error: "Missing itemId" }, { status: 400 });
  }

  const { data: itemRaw } = await supabase
    .from("items")
    .select(
      "id, name, brand, item_type, affiliate_url, affiliate_network, " +
        "catalog_item_id",
    )
    .eq("id", body.itemId)
    .maybeSingle();
  type ItemRow = {
    id: string;
    name: string;
    brand: string | null;
    item_type: string;
    affiliate_url: string | null;
    affiliate_network: string | null;
    catalog_item_id: string | null;
  };
  const item = itemRaw as unknown as ItemRow | null;
  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  // Skip if already has a real URL
  if (item.affiliate_url) {
    return NextResponse.json({ ok: true, status: "already_set" });
  }

  // CATALOG INHERITANCE — if the user item is linked to a catalog row
  // and that row already has a default_affiliate_url (set by an earlier
  // user's discovery run), copy it onto the user item instantly. No LLM
  // call needed. This is how the 99th user gets the same vetted vendor
  // the 1st user's discovery established.
  if (item.catalog_item_id) {
    const { data: catalogRaw } = await supabase
      .from("catalog_items")
      .select(
        "default_affiliate_url, default_vendor, default_list_price_cents, " +
          "default_affiliate_network",
      )
      .eq("id", item.catalog_item_id)
      .maybeSingle();
    type CatalogDefaultsRow = {
      default_affiliate_url: string | null;
      default_vendor: string | null;
      default_list_price_cents: number | null;
      default_affiliate_network: string | null;
    };
    const cat = catalogRaw as unknown as CatalogDefaultsRow | null;
    if (cat?.default_affiliate_url) {
      await supabase
        .from("items")
        .update({
          affiliate_url: cat.default_affiliate_url,
          affiliate_network: cat.default_affiliate_network,
          vendor: cat.default_vendor,
          list_price_cents: cat.default_list_price_cents,
          affiliate_lookup_status: "found",
          affiliate_lookup_attempted_at: new Date().toISOString(),
        })
        .eq("id", item.id);
      return NextResponse.json({
        ok: true,
        status: "inherited_from_catalog",
        url: cat.default_affiliate_url,
        network: cat.default_affiliate_network,
      });
    }
  }

  // Skip non-buyable types
  const BUYABLE_TYPES = new Set([
    "supplement",
    "topical",
    "device",
    "gear",
    "test",
    "food",
  ]);
  if (!BUYABLE_TYPES.has(item.item_type as string)) {
    await supabase
      .from("items")
      .update({
        affiliate_lookup_status: "skipped",
        affiliate_lookup_attempted_at: new Date().toISOString(),
      })
      .eq("id", item.id);
    return NextResponse.json({ ok: true, status: "skipped" });
  }

  // Fast path
  const fp = fastPath(item.name as string);
  if (fp) {
    const wrapped = wrapWithTrackingTag(fp.url, fp.network);
    await supabase
      .from("items")
      .update({
        affiliate_url: wrapped,
        affiliate_network: fp.network,
        vendor: fp.vendor,
        commission_rate: AFFILIATE_CONFIGS[fp.network].commissionRate,
        affiliate_lookup_status: "found",
        affiliate_lookup_attempted_at: new Date().toISOString(),
      })
      .eq("id", item.id);
    // Propagate to catalog row so all future users inherit
    if (item.catalog_item_id) {
      await supabase
        .from("catalog_items")
        .update({
          default_affiliate_url: wrapped,
          default_affiliate_network: fp.network,
          default_vendor: fp.vendor,
        })
        .eq("id", item.catalog_item_id);
    }
    return NextResponse.json({
      ok: true,
      status: "found_fast_path",
      url: wrapped,
      network: fp.network,
    });
  }

  // Coach-powered fallback
  try {
    const anthropic = getAnthropic();
    const prompt = `For the item "${item.name}"${item.brand ? ` (brand: ${item.brand})` : ""} of type "${item.item_type}", suggest the SINGLE best affiliate-link URL we could use. Choose ONE network from: amazon, iherb, thorne, fullscript. Prefer Amazon for non-pharmaceutical foods/gear, Thorne for pharma-grade supplements, iHerb for international/discount supplements, Fullscript for prescriber-network products.

Return ONLY a single JSON object on one line, no prose:
{"network":"amazon|iherb|thorne|fullscript","vendor":"<vendor name>","url":"<canonical product or search URL>"}

If you can't determine a good URL, return: {"network":"amazon","vendor":"Amazon","url":"https://www.amazon.com/s?k=<URL-encoded item name>"}`;

    const res = await anthropic.messages.create({
      model: MODELS.chat,
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    });
    const text =
      res.content
        .map((c) => (c.type === "text" ? c.text : ""))
        .join("")
        .trim();

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON in Coach response");
    const parsed = JSON.parse(match[0]) as {
      network: AffiliateNetwork;
      vendor: string;
      url: string;
    };

    const network: AffiliateNetwork =
      detectNetwork(parsed.url) ?? parsed.network ?? "amazon";
    let url = parsed.url;
    if (!url.startsWith("http")) {
      url = fallbackAmazonSearchUrl(item.name as string);
    }
    const wrapped = wrapWithTrackingTag(url, network);

    await supabase
      .from("items")
      .update({
        affiliate_url: wrapped,
        affiliate_network: network,
        vendor: parsed.vendor,
        commission_rate: AFFILIATE_CONFIGS[network].commissionRate,
        affiliate_lookup_status: "found",
        affiliate_lookup_attempted_at: new Date().toISOString(),
      })
      .eq("id", item.id);
    // Propagate to catalog row so future users sharing it inherit
    if (item.catalog_item_id) {
      await supabase
        .from("catalog_items")
        .update({
          default_affiliate_url: wrapped,
          default_affiliate_network: network,
          default_vendor: parsed.vendor,
        })
        .eq("id", item.catalog_item_id);
    }

    return NextResponse.json({
      ok: true,
      status: "found_via_coach",
      url: wrapped,
      network,
      vendor: parsed.vendor,
    });
  } catch (err) {
    // Mark as not_found but still set a fallback URL so BuyButton works
    const fallbackUrl = fallbackAmazonSearchUrl(item.name as string);
    await supabase
      .from("items")
      .update({
        affiliate_url: fallbackUrl,
        affiliate_network: "amazon",
        vendor: "Amazon",
        commission_rate: AFFILIATE_CONFIGS.amazon.commissionRate,
        affiliate_lookup_status: "not_found",
        affiliate_lookup_attempted_at: new Date().toISOString(),
      })
      .eq("id", item.id);
    return NextResponse.json({
      ok: true,
      status: "fallback_used",
      url: fallbackUrl,
      error: (err as Error).message,
    });
  }
}

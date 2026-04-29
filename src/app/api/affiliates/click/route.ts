// /api/affiliates/click — log an outbound affiliate click + return the
// tracked URL the client should open.
//
// Flow:
//   1. Client posts { itemId? OR { itemName, vendor, url }, source }
//   2. Server resolves the canonical affiliate URL (wraps with our tag)
//   3. Logs to affiliate_clicks table
//   4. Returns { ok, redirectUrl, network } — client opens in new tab
//
// We intentionally do this through our own server (vs. linking directly)
// so we can:
//   - Track clicks even on items without affiliate URLs (fallback to
//     Amazon search with our tag)
//   - Wrap raw URLs with tracking tags from env
//   - Power the revenue dashboard
//   - Detect conversion lag (click-to-order time)

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  detectNetwork,
  fallbackAmazonSearchUrl,
  wrapWithTrackingTag,
  type AffiliateNetwork,
} from "@/lib/affiliates";

export const runtime = "nodejs";

type ClickBody = {
  /** Preferred — server looks up the URL + name from the items row. */
  itemId?: string;
  /** Override path — used by /scan when a Coach-suggested item doesn't
   *  exist in items table yet. */
  itemName?: string;
  fallbackUrl?: string;
  vendor?: string;
  source?: string;
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: ClickBody;
  try {
    body = (await request.json()) as ClickBody;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  let url: string | null = null;
  let itemName: string | null = body.itemName ?? null;
  let vendor: string | null = body.vendor ?? null;
  let network: AffiliateNetwork | null = null;
  let itemId: string | null = body.itemId ?? null;

  if (body.itemId) {
    const { data: item } = await supabase
      .from("items")
      .select(
        "id, name, vendor, affiliate_url, affiliate_network, purchase_url",
      )
      .eq("id", body.itemId)
      .maybeSingle();
    if (item) {
      itemId = item.id;
      itemName = item.name;
      vendor = (item.vendor as string | null) ?? null;
      url =
        (item.affiliate_url as string | null) ??
        (item.purchase_url as string | null) ??
        null;
      network =
        (item.affiliate_network as AffiliateNetwork | null) ??
        (url ? detectNetwork(url) : null);
    }
  }

  // If we still don't have a URL, fall back to Amazon search with our tag
  // so the user gets SOMETHING and we still capture potential commission.
  if (!url) {
    const query = body.itemName ?? itemName ?? "";
    if (!query.trim() && !body.fallbackUrl) {
      return NextResponse.json(
        { error: "No URL or item name provided" },
        { status: 400 },
      );
    }
    if (body.fallbackUrl) {
      url = body.fallbackUrl;
      network = detectNetwork(body.fallbackUrl);
    } else {
      url = fallbackAmazonSearchUrl(query);
      network = "amazon";
    }
  }

  // Wrap with tracking tag if we know the network
  const redirectUrl = network ? wrapWithTrackingTag(url, network) : url;

  // Fire-and-forget log (don't block the redirect on a slow insert)
  void supabase
    .from("affiliate_clicks")
    .insert({
      user_id: user.id,
      item_id: itemId,
      item_name: itemName,
      affiliate_network: network,
      vendor: vendor,
      affiliate_url: redirectUrl,
      source: body.source ?? null,
    })
    .then(() => {});

  return NextResponse.json({ ok: true, redirectUrl, network });
}

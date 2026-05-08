// /api/items/enrich — orchestrates auto-enrichment for a newly-added
// item. Designed to be called fire-and-forget right after item insert
// from /api/proposals/execute, /api/items/quick-add, /api/onboarding/
// starter-pack/add, etc.
//
// Pipeline (each step skips if already populated):
//   1. CATALOG MATCH — find or generate a catalog_items row for this
//      item, link via catalog_item_id. Catalog supplies macros / micros
//      / mechanism / timing / brand recs / cautions.
//   2. CATALOG INHERITANCE — copy the catalog's media_url / how_to /
//      default vendor / default affiliate URL / default price onto the
//      user's item. Coach already curated these for the catalog row;
//      every user inherits.
//   3. TUTORIAL GEN — for practice/device/gear without media_url,
//      Coach generates a curated tutorial URL + plain-English how_to.
//      Result is written BOTH to the user item AND back to the
//      catalog row so other users benefit (saves ~$0.02 per user).
//   4. AFFILIATE DISCOVERY — if buyable + still no affiliate_url,
//      call /api/affiliates/discover (which has its own LLM logic).
//
// Idempotent: safe to call multiple times. Each step is a no-op if
// the field is already populated.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAnthropic, MODELS } from "@/lib/anthropic";
import { rateLimitOrError, recordUsage } from "@/lib/rate-limit";
import { userSubmission } from "@/lib/catalog/moderation";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = { item_id: string };

const TUTORIAL_PROMPT = (
  name: string,
  itemType: string,
) => `You're populating a tutorial reference for "${name}" (${itemType}). The user wants a HOW-TO link + plain-English summary so they can actually do this practice correctly.

Return JSON only:
{
  "media_url": "<a real, well-known YouTube URL or null. Pick the most-watched authoritative tutorial that exists. NEVER invent a URL — if you don't know a real one, return null.>",
  "how_to": "<2-4 sentences. Concrete instructions, not motivational. Include sets/reps/duration/positioning where relevant. Voice: like a knowledgeable trainer giving a quick how-to over the shoulder.>"
}

Rules:
- For mewing → Mike Mew tongue-position video (https://www.youtube.com/watch?v=oUGDvy3UI8E)
- For Koyama scalp massage → the standardized 4-min tutorial
- For 4-7-8 breath → Andrew Weil's video
- For physiological sigh → Huberman's Stanford clip
- For Zone 2 cardio → Peter Attia / Inigo San Millan
- For specific gym lifts → Jeff Nippard or Renaissance Periodization form videos
- If the item is a brand-name device with a known protocol (Theragun, Higher Dose sauna, etc.), link to the manufacturer's how-to
- If you genuinely don't know a real URL, return null for media_url — DO NOT invent

Just the JSON. No preamble.`;

type TutorialResponse = {
  media_url: string | null;
  how_to: string | null;
};

async function generateTutorial(
  name: string,
  itemType: string,
  userId: string,
): Promise<TutorialResponse> {
  try {
    const anthropic = getAnthropic();
    const res = await anthropic.messages.create({
      model: MODELS.chat,
      max_tokens: 400,
      messages: [
        { role: "user", content: TUTORIAL_PROMPT(name, itemType) },
      ],
    });
    void recordUsage(userId, "enrich", {
      route: "/api/items/enrich",
      model: MODELS.chat,
      tokens_in: res.usage?.input_tokens,
      tokens_out: res.usage?.output_tokens,
    });
    const block = res.content[0];
    if (!block || block.type !== "text") return { media_url: null, how_to: null };
    const raw = block.text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(raw) as TutorialResponse;
    // Defensive: drop URLs that don't match a known-real pattern
    // (Coach sometimes hallucinates plausible-looking but fake URLs).
    if (parsed.media_url) {
      const url = parsed.media_url;
      const hasRealWatchId =
        /youtube\.com\/watch\?v=[A-Za-z0-9_-]{8,}/.test(url) ||
        /youtu\.be\/[A-Za-z0-9_-]{8,}/.test(url);
      const isKnownTrustedHost =
        /^https?:\/\/(www\.)?(vimeo\.com|loom\.com|hubermanlab\.com|stanford\.edu)\//i.test(
          url,
        );
      if (!hasRealWatchId && !isKnownTrustedHost) {
        parsed.media_url = null;
      }
    }
    return parsed;
  } catch {
    return { media_url: null, how_to: null };
  }
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
  if (!body.item_id) {
    return NextResponse.json({ error: "Missing item_id" }, { status: 400 });
  }

  const limited = await rateLimitOrError(user.id, "enrich");
  if (limited) return limited;

  const admin = createAdminClient();

  // Pull the item — admin client so we can also write to catalog
  // (which has stricter RLS).
  const { data: itemRaw } = await admin
    .from("items")
    .select(
      "id, user_id, name, brand, item_type, catalog_item_id, " +
        "vendor, affiliate_url, list_price_cents, media_url, how_to",
    )
    .eq("id", body.item_id)
    .eq("user_id", user.id)
    .maybeSingle();
  type ItemRow = {
    id: string;
    user_id: string;
    name: string;
    brand: string | null;
    item_type: string;
    catalog_item_id: string | null;
    vendor: string | null;
    affiliate_url: string | null;
    list_price_cents: number | null;
    media_url: string | null;
    how_to: string | null;
  };
  const item = itemRaw as ItemRow | null;
  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const steps: string[] = [];

  // ================================================================
  // STEP 1 — CATALOG MATCH
  // ================================================================
  let catalogId = item.catalog_item_id;
  if (!catalogId) {
    // Try direct name match in catalog (ILIKE handles case + minor
    // formatting differences). Only match against verified entries OR
    // the calling user's own pending entries — never inherit from
    // another user's unvetted submission.
    const { data: catalogMatch } = await admin
      .from("catalog_items")
      .select("id")
      .ilike("name", item.name.trim())
      .eq("item_type", item.item_type)
      .or(`is_verified.eq.true,submitted_by.eq.${user.id}`)
      .limit(1)
      .maybeSingle();
    if (catalogMatch) {
      catalogId = catalogMatch.id;
      steps.push("catalog_match");
    } else {
      // Generate a fresh catalog row via Claude. Inline the call rather
      // than fetching /api/catalog/generate (saves a round trip and
      // keeps auth simpler).
      try {
        const anthropic = getAnthropic();
        const GEN_PROMPT = `Catalog entry for "${item.name}"${item.brand ? ` (${item.brand})` : ""} (${item.item_type}). Honesty over completeness — if uncertain, return null. Output JSON only:
{"name":"<canonical>","brand":"<or null>","item_type":"${item.item_type}","category":"<short category or null>","serving_size":"<or null>","calories":<num or null>,"protein_g":<num or null>,"fat_g":<num or null>,"carbs_g":<num or null>,"fiber_g":<num or null>,"sugar_g":<num or null>,"coach_summary":"<2-3 sentences>","mechanism":"<1-2 sentences or null>","best_timing":"<short or null>","evidence_grade":"<A|B|C|D>"}`;
        const r = await anthropic.messages.create({
          model: MODELS.chat,
          max_tokens: 800,
          messages: [{ role: "user", content: GEN_PROMPT }],
        });
        void recordUsage(user.id, "enrich", {
          route: "/api/items/enrich",
          model: MODELS.chat,
          tokens_in: r.usage?.input_tokens,
          tokens_out: r.usage?.output_tokens,
        });
        const b = r.content[0];
        if (b?.type === "text") {
          const raw = b.text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
          type GenResult = {
            name: string;
            brand: string | null;
            item_type: string;
            category: string | null;
            serving_size: string | null;
            calories: number | null;
            protein_g: number | null;
            fat_g: number | null;
            carbs_g: number | null;
            fiber_g: number | null;
            sugar_g: number | null;
            coach_summary: string | null;
            mechanism: string | null;
            best_timing: string | null;
            evidence_grade: string | null;
          };
          const parsed = JSON.parse(raw) as GenResult;
          // User-submitted catalog row — visible only to this user
          // until an admin promotes it via /admin/catalog. Prevents
          // one user's hallucinated entry from leaking into every
          // other user's autocomplete.
          const { data: inserted } = await admin
            .from("catalog_items")
            .insert({
              source: "coach",
              name: parsed.name ?? item.name,
              brand: parsed.brand,
              item_type: parsed.item_type,
              category: parsed.category,
              serving_size: parsed.serving_size,
              calories: parsed.calories,
              protein_g: parsed.protein_g,
              fat_g: parsed.fat_g,
              carbs_g: parsed.carbs_g,
              fiber_g: parsed.fiber_g,
              sugar_g: parsed.sugar_g,
              coach_summary: parsed.coach_summary,
              mechanism: parsed.mechanism,
              best_timing: parsed.best_timing,
              evidence_grade: parsed.evidence_grade,
              enriched_at: new Date().toISOString(),
              enriched_by: "coach-v1",
              ...userSubmission(user.id),
            })
            .select("id")
            .single();
          if (inserted) {
            catalogId = inserted.id;
            steps.push("catalog_generated");
          }
        }
      } catch {
        // Catalog generation failed — continue without
        steps.push("catalog_generate_failed");
      }
    }

    if (catalogId) {
      await admin
        .from("items")
        .update({ catalog_item_id: catalogId })
        .eq("id", item.id);
      item.catalog_item_id = catalogId;
    }
  }

  // ================================================================
  // STEP 2 — CATALOG INHERITANCE (copy useful fields onto user item)
  // ================================================================
  if (catalogId) {
    // Inherit only from verified catalog rows or rows the calling
    // user submitted. The match step above already constrained to
    // these, but we re-filter here to make the security boundary
    // explicit at every read site. (Defense-in-depth: if a future
    // bug widens step 1, step 2 still won't leak unvetted data.)
    const { data: catalogRowRaw } = await admin
      .from("catalog_items")
      .select(
        "media_url, how_to, default_vendor, default_affiliate_url, " +
          "default_list_price_cents, default_affiliate_network, " +
          "is_verified, submitted_by",
      )
      .eq("id", catalogId)
      .or(`is_verified.eq.true,submitted_by.eq.${user.id}`)
      .maybeSingle();
    type CatalogRow = {
      media_url: string | null;
      how_to: string | null;
      default_vendor: string | null;
      default_affiliate_url: string | null;
      default_list_price_cents: number | null;
      default_affiliate_network: string | null;
      is_verified: boolean;
      submitted_by: string | null;
    };
    const cat = catalogRowRaw as CatalogRow | null;
    if (cat) {
      const updates: Record<string, unknown> = {};
      if (!item.media_url && cat.media_url) {
        updates.media_url = cat.media_url;
        item.media_url = cat.media_url;
      }
      if (!item.how_to && cat.how_to) {
        updates.how_to = cat.how_to;
        item.how_to = cat.how_to;
      }
      if (!item.affiliate_url && cat.default_affiliate_url) {
        updates.affiliate_url = cat.default_affiliate_url;
        updates.affiliate_network = cat.default_affiliate_network;
        updates.vendor = cat.default_vendor;
        updates.list_price_cents = cat.default_list_price_cents;
        updates.affiliate_lookup_status = "found";
        updates.affiliate_lookup_attempted_at = new Date().toISOString();
        item.affiliate_url = cat.default_affiliate_url;
        item.vendor = cat.default_vendor;
        item.list_price_cents = cat.default_list_price_cents;
      }
      if (Object.keys(updates).length > 0) {
        await admin.from("items").update(updates).eq("id", item.id);
        steps.push("inherit_from_catalog");
      }
    }
  }

  // ================================================================
  // STEP 3 — TUTORIAL GENERATION (practice/device/gear without media_url)
  // ================================================================
  const TUTORIAL_TYPES = new Set(["practice", "device", "gear", "procedure"]);
  if (!item.media_url && TUTORIAL_TYPES.has(item.item_type)) {
    const tut = await generateTutorial(item.name, item.item_type, user.id);
    if (tut.media_url || tut.how_to) {
      const updates: Record<string, unknown> = {};
      if (tut.media_url) updates.media_url = tut.media_url;
      if (tut.how_to && !item.how_to) updates.how_to = tut.how_to;
      await admin.from("items").update(updates).eq("id", item.id);
      // Write back to catalog ONLY if the calling user submitted this
      // catalog row. Don't mutate verified rows from a user-driven
      // flow — that would let one user's hallucinated tutorial URL
      // propagate to every other user. Admin /admin/catalog can
      // backfill tutorials on verified rows manually.
      if (catalogId) {
        const catUpdates: Record<string, unknown> = {};
        if (tut.media_url) catUpdates.media_url = tut.media_url;
        if (tut.how_to) catUpdates.how_to = tut.how_to;
        if (Object.keys(catUpdates).length > 0) {
          await admin
            .from("catalog_items")
            .update(catUpdates)
            .eq("id", catalogId)
            .eq("submitted_by", user.id);
        }
      }
      steps.push("tutorial_generated");
    }
  }

  // ================================================================
  // STEP 4 — AFFILIATE DISCOVERY (buyable items without URL)
  // ================================================================
  const BUYABLE = new Set([
    "supplement",
    "topical",
    "device",
    "gear",
    "test",
    "food",
  ]);
  if (!item.affiliate_url && BUYABLE.has(item.item_type)) {
    // Fire the existing /api/affiliates/discover. Inline-call its logic
    // would be duplication — safer to ping the route. Use the user's
    // session cookie since the endpoint is auth-gated.
    try {
      const cookie = request.headers.get("cookie") ?? "";
      const origin = request.nextUrl.origin;
      void fetch(`${origin}/api/affiliates/discover`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie,
        },
        body: JSON.stringify({ itemId: item.id }),
      });
      steps.push("affiliate_dispatched");
    } catch {
      steps.push("affiliate_dispatch_failed");
    }
  }

  return NextResponse.json({ ok: true, item_id: item.id, steps });
}

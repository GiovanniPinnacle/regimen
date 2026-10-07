// Per-user rate limiting for Anthropic-backed routes.
//
// Approach: count rows in llm_usage (migration 028) for the user's
// bucket in the last 24h. Reject when over cap. Async-record after
// each successful call so the next request sees the bumped count.
//
// Why a Postgres counter and not Upstash / Redis: keeps infra
// surface area small. Counts are accurate enough at v1 scale (a
// few thousand users), and the same table doubles as a cost-analysis
// log we'd want to keep anyway. We can swap to Upstash if write
// volume becomes a problem.

import { createAdminClient } from "@/lib/supabase/admin";

export type LLMBucket =
  | "coach" // chat / ask / refine / voice-memo
  | "research" // deep-research, research-bulk
  | "vision" // bloodwork-parse, photo analyze
  | "enrich" // items/enrich, catalog/generate, catalog/enrich, affiliates/discover
  | "digest"; // weekly-digest, symptom-correlations

// Per-24h caps. Calibrated for the ~$0.05-0.50 cost-per-call range
// each bucket sees, so a maxed-out free user costs at most ~$2/day
// across all buckets. Pro tier (when we wire it) gets 5× these.
const CAPS: Record<LLMBucket, number> = {
  coach: 100,
  research: 5,
  vision: 10,
  enrich: 50,
  digest: 5,
};

const WINDOW_MS = 24 * 60 * 60 * 1000;

/** Buckets where one call costs real money (Opus deep research, vision).
 *  These get two stricter behaviours:
 *
 *  1. Reserve-then-count. check → (LLM call, seconds) → record is a
 *     check-then-act race: N parallel requests all see `used < cap` and
 *     all go through. For strict buckets the check INSERTs a placeholder
 *     row first and then counts, so concurrent requests see each other's
 *     reservations. Under contention this can over-reject (two racers
 *     both see cap+1 and both back off) but never over-admit. The
 *     placeholder is filled in by recordUsage(); if the LLM call fails
 *     the reservation still counts — conservative by design.
 *  2. Fail closed. If llm_usage can't be read/written we reject (503)
 *     instead of letting an unmetered Opus call through.
 *
 *  Cheap buckets keep the plain count check and fail open: an extra call
 *  or two past the cap during a race / DB blip is cheaper than locking
 *  users out of Coach. */
const STRICT_BUCKETS: ReadonlySet<LLMBucket> = new Set(["research", "vision"]);

/** route value marking a strict-bucket reservation not yet filled in. */
const RESERVED_ROUTE = "(reserved)";

export type RateLimitResult =
  | { ok: true; remaining: number; cap: number }
  | { ok: false; remaining: 0; cap: number; retryAfterSeconds: number; reason: "limit" }
  | { ok: false; remaining: 0; cap: number; retryAfterSeconds: number; reason: "unavailable" };

async function countRecent(
  userId: string,
  bucket: LLMBucket,
  since: string,
): Promise<number | null> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("llm_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("bucket", bucket)
    .gte("created_at", since);
  if (error) {
    console.error("rate-limit: count failed", bucket, error);
    return null;
  }
  return count ?? 0;
}

async function retryAfterFor(
  userId: string,
  bucket: LLMBucket,
  since: string,
): Promise<number> {
  // Find the oldest row in the window so we can compute when one slot
  // frees up. Defensive default: 1 hour.
  const admin = createAdminClient();
  const { data: oldest } = await admin
    .from("llm_usage")
    .select("created_at")
    .eq("user_id", userId)
    .eq("bucket", bucket)
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const oldestTs = oldest?.created_at
    ? new Date(oldest.created_at).getTime()
    : Date.now();
  return Math.max(60, Math.ceil((oldestTs + WINDOW_MS - Date.now()) / 1000));
}

/** Check whether the user can make another call in this bucket.
 *  Cheap buckets: does NOT record — caller awaits the LLM, then
 *  fire-and-forgets recordUsage(). Strict buckets: also reserves a slot
 *  (see STRICT_BUCKETS) which recordUsage() later fills in. */
export async function checkRateLimit(
  userId: string,
  bucket: LLMBucket,
): Promise<RateLimitResult> {
  const cap = CAPS[bucket];
  const since = new Date(Date.now() - WINDOW_MS).toISOString();

  if (!STRICT_BUCKETS.has(bucket)) {
    const used = await countRecent(userId, bucket, since);
    // Fail open on a DB hiccup — bounded by cap × cost for cheap buckets.
    if (used == null) return { ok: true, remaining: cap, cap };
    if (used >= cap) {
      return {
        ok: false,
        remaining: 0,
        cap,
        reason: "limit",
        retryAfterSeconds: await retryAfterFor(userId, bucket, since),
      };
    }
    return { ok: true, remaining: cap - used, cap };
  }

  // Strict bucket: reserve, then count (includes our own reservation).
  const admin = createAdminClient();
  const { data: reservation, error: insErr } = await admin
    .from("llm_usage")
    .insert({ user_id: userId, bucket, route: RESERVED_ROUTE })
    .select("id")
    .single();
  if (insErr || !reservation) {
    console.error("rate-limit: reserve failed (failing closed)", bucket, insErr);
    return { ok: false, remaining: 0, cap, reason: "unavailable", retryAfterSeconds: 60 };
  }
  const used = await countRecent(userId, bucket, since);
  if (used == null || used > cap) {
    await admin.from("llm_usage").delete().eq("id", reservation.id);
    if (used == null) {
      return { ok: false, remaining: 0, cap, reason: "unavailable", retryAfterSeconds: 60 };
    }
    return {
      ok: false,
      remaining: 0,
      cap,
      reason: "limit",
      retryAfterSeconds: await retryAfterFor(userId, bucket, since),
    };
  }
  return { ok: true, remaining: cap - used, cap };
}

/** Record a successful LLM call. Async, fire-and-forget. Failures
 *  here only mean the next limit check sees a slightly stale count;
 *  the caller's request still succeeded. */
export async function recordUsage(
  userId: string,
  bucket: LLMBucket,
  meta: {
    route: string;
    model?: string;
    tokens_in?: number;
    tokens_out?: number;
    cost_cents?: number;
  },
): Promise<void> {
  try {
    const admin = createAdminClient();
    const row = {
      route: meta.route,
      model: meta.model ?? null,
      tokens_in: meta.tokens_in ?? null,
      tokens_out: meta.tokens_out ?? null,
      cost_cents: meta.cost_cents ?? null,
    };
    if (STRICT_BUCKETS.has(bucket)) {
      // Fill in this user's oldest open reservation instead of adding a
      // second row for the same call.
      const { data: open } = await admin
        .from("llm_usage")
        .select("id")
        .eq("user_id", userId)
        .eq("bucket", bucket)
        .eq("route", RESERVED_ROUTE)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (open) {
        const { error } = await admin
          .from("llm_usage")
          .update(row)
          .eq("id", open.id);
        if (error) console.error("rate-limit: record (update) failed", error);
        return;
      }
    }
    const { error } = await admin
      .from("llm_usage")
      .insert({ user_id: userId, bucket, ...row });
    if (error) console.error("rate-limit: record failed", error);
  } catch (e) {
    // Swallow — see comment above.
    console.error("rate-limit: record threw", e);
  }
}

/** Convenience: check + return a 429 NextResponse if rejected,
 *  otherwise null. Pattern:
 *
 *    const limited = await rateLimitOrError(user.id, "vision");
 *    if (limited) return limited;
 *    // ... do the LLM call ...
 *    void recordUsage(user.id, "vision", { route: "/api/bloodwork/parse" });
 */
export async function rateLimitOrError(
  userId: string,
  bucket: LLMBucket,
  // dynamically import NextResponse so this helper can be used
  // outside the route runtime if needed
): Promise<Response | null> {
  const result = await checkRateLimit(userId, bucket);
  if (result.ok) return null;
  if (result.reason === "unavailable") {
    return new Response(
      JSON.stringify({
        error: "Usage tracking is temporarily unavailable. Please try again in a minute.",
        code: "rate_limit_unavailable",
        bucket,
      }),
      {
        status: 503,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(result.retryAfterSeconds),
        },
      },
    );
  }
  return new Response(
    JSON.stringify({
      error: `Daily limit reached for ${bucket}.`,
      code: "rate_limited",
      bucket,
      cap: result.cap,
      retry_after_seconds: result.retryAfterSeconds,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(result.retryAfterSeconds),
      },
    },
  );
}

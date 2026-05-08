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

export type RateLimitResult =
  | { ok: true; remaining: number; cap: number }
  | { ok: false; remaining: 0; cap: number; retryAfterSeconds: number };

/** Check whether the user can make another call in this bucket.
 *  Does NOT record the call — caller should await the LLM, then
 *  fire-and-forget recordUsage() on success. */
export async function checkRateLimit(
  userId: string,
  bucket: LLMBucket,
): Promise<RateLimitResult> {
  const cap = CAPS[bucket];
  const since = new Date(Date.now() - WINDOW_MS).toISOString();

  const admin = createAdminClient();
  const { count, error } = await admin
    .from("llm_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("bucket", bucket)
    .gte("created_at", since);

  if (error) {
    // Fail open — better to occasionally let an extra call through
    // than to lock everyone out on a transient DB hiccup. The cost
    // ceiling is bounded by the cap × ~24h anyway.
    return { ok: true, remaining: cap, cap };
  }

  const used = count ?? 0;
  if (used >= cap) {
    // Find the oldest row in the window so we can compute when one
    // slot frees up. Defensive default: 1 hour.
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
    const retryAfterSeconds = Math.max(
      60,
      Math.ceil((oldestTs + WINDOW_MS - Date.now()) / 1000),
    );
    return { ok: false, remaining: 0, cap, retryAfterSeconds };
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
    await admin.from("llm_usage").insert({
      user_id: userId,
      bucket,
      route: meta.route,
      model: meta.model ?? null,
      tokens_in: meta.tokens_in ?? null,
      tokens_out: meta.tokens_out ?? null,
      cost_cents: meta.cost_cents ?? null,
    });
  } catch {
    // Swallow — see comment above.
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
  return new Response(
    JSON.stringify({
      error: `Daily limit reached for ${bucket}.`,
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

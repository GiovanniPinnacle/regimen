// /api/intake/frequent — top frequent meals for one-tap re-log.
//
// Groups the user's last 30 days of intake_log meal/snack entries by
// lowercased content, returns the top 5 with macros pulled from the
// most-recent occurrence. UX: user opens the log sheet, sees their
// most-eaten meals as quick-tap chips at the top — one tap re-logs
// it without re-analyzing.
//
// Pure aggregation — no LLM.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = {
  content: string;
  kind: string;
  calories: number | null;
  protein_g: number | string | null;
  fat_g: number | string | null;
  carbs_g: number | string | null;
  serving: string | null;
  date: string;
  logged_at: string;
};

export type FrequentMeal = {
  content: string;
  kind: "meal" | "snack";
  calories: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carbs_g: number | null;
  serving: string | null;
  /** Number of times this meal appeared in the 30-day window. */
  occurrences: number;
  /** ISO date of the most-recent occurrence. */
  last_logged: string;
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const admin = createAdminClient();
  const since = new Date(Date.now() - 30 * 86400000)
    .toISOString()
    .slice(0, 10);

  const { data } = await admin
    .from("intake_log")
    .select(
      "content, kind, calories, protein_g, fat_g, carbs_g, serving, date, logged_at",
    )
    .eq("user_id", user.id)
    .in("kind", ["meal", "snack"])
    .gte("date", since)
    .order("logged_at", { ascending: false })
    .limit(200);

  const rows = (data ?? []) as Row[];

  // Group by normalized content. Normalization is intentionally light
  // (lowercase + collapse whitespace) — we don't try semantic match
  // because that's where it gets brittle. If user logs "4 eggs" vs
  // "four eggs", those count as different meals — fine, both are
  // surfaceable separately.
  type Bucket = {
    content: string; // verbatim (most-recent occurrence's casing)
    kind: "meal" | "snack";
    occurrences: number;
    last_logged: string;
    macros: {
      calories: number | null;
      protein_g: number | null;
      fat_g: number | null;
      carbs_g: number | null;
      serving: string | null;
    };
  };
  const buckets = new Map<string, Bucket>();
  for (const r of rows) {
    if (!r.content) continue;
    const key = r.content.toLowerCase().replace(/\s+/g, " ").trim();
    if (!key) continue;
    const existing = buckets.get(key);
    if (!existing) {
      buckets.set(key, {
        content: r.content.trim(),
        kind: r.kind === "snack" ? "snack" : "meal",
        occurrences: 1,
        last_logged: r.logged_at,
        macros: {
          calories: r.calories,
          protein_g: r.protein_g != null ? Number(r.protein_g) : null,
          fat_g: r.fat_g != null ? Number(r.fat_g) : null,
          carbs_g: r.carbs_g != null ? Number(r.carbs_g) : null,
          serving: r.serving,
        },
      });
    } else {
      existing.occurrences += 1;
      // Keep the most-recent macros (the loop is sorted desc, so the
      // FIRST one we see is the most-recent — keep that one).
    }
  }

  // Filter out one-off "novel" meals so the chip row stays tight. We
  // also surface single-occurrence items if the user hasn't built
  // history yet (filtering would leave the array empty).
  const all = Array.from(buckets.values());
  const repeated = all.filter((b) => b.occurrences >= 2);
  const pool = repeated.length >= 3 ? repeated : all;

  pool.sort((a, b) => {
    if (b.occurrences !== a.occurrences) return b.occurrences - a.occurrences;
    return b.last_logged.localeCompare(a.last_logged);
  });

  const meals: FrequentMeal[] = pool.slice(0, 5).map((b) => ({
    content: b.content,
    kind: b.kind,
    calories: b.macros.calories,
    protein_g: b.macros.protein_g,
    fat_g: b.macros.fat_g,
    carbs_g: b.macros.carbs_g,
    serving: b.macros.serving,
    occurrences: b.occurrences,
    last_logged: b.last_logged,
  }));

  return NextResponse.json({ meals });
}

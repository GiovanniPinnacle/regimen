// Scheduled task generators. Called by /api/cron/daily once per day.
// Each function returns an array of InsightRow to insert.

import { createAdminClient } from "@/lib/supabase/admin";
import { assertCompleted, getAnthropic, MODEL_OPTS, textOf } from "@/lib/anthropic";
import {
  buildContextForUser,
  contextToSystemPrompt,
} from "@/lib/context";
import type { Item } from "@/lib/types";
import { addDaysISO } from "@/lib/series";
import { getUserToday } from "@/lib/user-date";
import { dailySuggestionPrompt, postOpDayFor } from "@/lib/personalization";
import type { SupabaseClient } from "@supabase/supabase-js";

export type InsightRow = {
  user_id: string;
  type: string;
  title: string;
  body: string;
  confidence: "low" | "medium" | "high";
  status: "new";
};

/** The user's post-op day (user-local), or null when profiles.postop_date
 *  is unset. Every post-op feature keys off this — there is NO global
 *  fallback date, so users without a procedure never get post-op alerts. */
export async function getPostOpDay(
  admin: SupabaseClient,
  userId: string,
): Promise<{ day: number | null; today: string }> {
  const [{ today }, { data, error }] = await Promise.all([
    getUserToday(admin, userId),
    admin.from("profiles").select("postop_date").eq("id", userId).maybeSingle(),
  ]);
  if (error) console.error("getPostOpDay: profiles", error);
  return {
    day: postOpDayFor((data?.postop_date as string | null) ?? null, today),
    today,
  };
}

// Day-milestone triggers: post-op day → items that should activate.
// Keyed to the original owner's seed_ids, so they only ever match a user
// who has those queued seed items AND a postop_date.
const DAY_MILESTONES: Record<number, { seed_ids: string[]; note: string }> = {
  14: {
    seed_ids: ["q-omega3", "q-curcumin"],
    note: "Antiplatelet window closed. Omega-3 full dose + curcumin safe to start.",
  },
  21: {
    seed_ids: ["q-procapil", "q-resistance-training"],
    note: "Procapil serum nightly + resistance training resume.",
  },
  28: {
    seed_ids: ["q-keto", "q-zpt"],
    note: "Ketoconazole 2% + ZPT alternating schedule can start (Rx via Strut/Happy Head).",
  },
  30: {
    seed_ids: ["q-rosemary-oil", "q-azelaic", "q-sauna"],
    note: "Rosemary oil 1% + azelaic 15% + sauna 3x/wk with surgeon clearance.",
  },
  35: {
    seed_ids: ["q-redwood-max", "q-hiit"],
    note: "Redwood Max (situational) + HIIT intervals.",
  },
};

export async function generateDayMilestoneInsights(
  userId: string,
): Promise<InsightRow[]> {
  const admin = createAdminClient();
  const { day: today } = await getPostOpDay(admin, userId);
  if (today == null) return [];
  const milestone = DAY_MILESTONES[today];
  if (!milestone) return [];

  const { data: queuedHits } = await admin
    .from("items")
    .select("id, name, seed_id")
    .eq("user_id", userId)
    .eq("status", "queued")
    .in("seed_id", milestone.seed_ids);

  if (!queuedHits || queuedHits.length === 0) return [];

  const names = queuedHits.map((q) => q.name).join(", ");
  return [
    {
      user_id: userId,
      type: "day_milestone",
      title: `Day ${today}: time to activate ${queuedHits.length} queued item${queuedHits.length > 1 ? "s" : ""}`,
      body: `${milestone.note}\n\nReady to promote: ${names}`,
      confidence: "high",
      status: "new",
    },
  ];
}

// Cycle flip alerts for items with frequency='cycle_8_2'
export async function generateCycleInsights(
  userId: string,
): Promise<InsightRow[]> {
  const admin = createAdminClient();
  const { data: items } = await admin
    .from("items")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active");

  const insights: InsightRow[] = [];
  const msPerDay = 1000 * 60 * 60 * 24;

  for (const item of (items ?? []) as Item[]) {
    if (item.schedule_rule?.frequency !== "cycle_8_2") continue;
    // Anchor on started_on, else when the item was added.
    const anchorISO = item.started_on ?? item.created_at;
    if (!anchorISO) continue;
    const anchor = new Date(anchorISO);
    const daysIn = Math.floor((Date.now() - anchor.getTime()) / msPerDay);
    const on = item.schedule_rule.cycle_on_days ?? 56;
    const off = item.schedule_rule.cycle_off_days ?? 14;
    const cycleLen = on + off;
    const posInCycle = daysIn % cycleLen;

    // Alert on transition day
    if (posInCycle === 0 && daysIn > 0) {
      insights.push({
        user_id: userId,
        type: "cycle_flip",
        title: `${item.name}: start ON phase`,
        body: `${on} days ON starts today.`,
        confidence: "high",
        status: "new",
      });
    } else if (posInCycle === on) {
      insights.push({
        user_id: userId,
        type: "cycle_flip",
        title: `${item.name}: start OFF phase`,
        body: `${off} days OFF starts today. Hold until ${new Date(Date.now() + off * msPerDay).toLocaleDateString()}.`,
        confidence: "high",
        status: "new",
      });
    }
  }
  return insights;
}

// Biotin pause: 72h before any upcoming bloodwork review. Only for users
// with an ACTIVE item containing biotin — named in the alert.
export async function generateBiotinAlert(
  userId: string,
): Promise<InsightRow[]> {
  const admin = createAdminClient();
  const { data: itemRows, error: itemsErr } = await admin
    .from("items")
    .select("name")
    .eq("user_id", userId)
    .eq("status", "active")
    .ilike("name", "%biotin%");
  if (itemsErr) console.error("generateBiotinAlert: items", itemsErr);
  const biotinNames = ((itemRows ?? []) as { name: string }[]).map((i) => i.name);
  if (biotinNames.length === 0) return [];

  // Cron runs in UTC — anchor on the user's local day.
  const { today } = await getUserToday(admin, userId);
  const target = addDaysISO(today, 3);

  const { data, error } = await admin
    .from("reviews")
    .select("scheduled_date, phase_name")
    .eq("user_id", userId)
    .eq("scheduled_date", target);
  if (error) console.error("generateBiotinAlert: reviews", error);

  const bloodwork = (data ?? []).filter((r) =>
    /bloodwork|function health|labs?/i.test(r.phase_name),
  );
  if (bloodwork.length === 0) return [];

  return [
    {
      user_id: userId,
      type: "biotin_pause",
      title: "⚠️ Pause biotin starting today",
      body: `You have bloodwork scheduled in 3 days (${target}). Pause ${biotinNames.join(", ")} now — biotin skews lab assays. Resume after the blood draw.`,
      confidence: "high",
      status: "new",
    },
  ];
}

// Generate ONE daily suggestion — an item Claude thinks the user should consider adding or changing
export async function generateDailySuggestion(
  userId: string,
): Promise<InsightRow[]> {
  try {
    const ctx = await buildContextForUser(userId);
    const system = contextToSystemPrompt(ctx);
    const anthropic = getAnthropic();
    const res = await anthropic.messages.create({
      ...MODEL_OPTS.chat,
      max_tokens: 400,
      system,
      messages: [
        {
          role: "user",
          content: dailySuggestionPrompt(ctx),
        },
      ],
    });
    // Truncated / refused output would become a garbage insight — drop it.
    assertCompleted(res);
    const text = textOf(res).trim();
    if (!text) return [];

    // Parse Title: / Body: format — fall back gracefully
    const titleMatch =
      text.match(/^\s*\**\s*Title\s*:\s*\**\s*(.+?)\s*\**\s*$/im) ??
      text.match(/^\s*#+\s*(.+?)\s*$/m); // markdown heading fallback
    const bodyMatch = text.match(/Body\s*:\s*\**\s*([\s\S]+?)$/im);
    let title = titleMatch?.[1]?.trim();
    let body = bodyMatch?.[1]?.trim();

    // Last-resort: use first line as title, rest as body
    if (!title) {
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length > 0) {
        title = lines[0].replace(/^[#*-\s]+/, "").trim().slice(0, 80);
        body = lines.slice(1).join("\n").trim() || title;
      }
    }
    if (!title) return [];
    if (!body) body = text;

    return [
      {
        user_id: userId,
        type: "daily_suggestion",
        title: `💡 ${title}`,
        body,
        confidence: "medium",
        status: "new",
      },
    ];
  } catch (e) {
    console.error("daily suggestion generation failed", e);
    return [];
  }
}

// ----- Day-milestone auto-promote -----
// Scans queued items whose review_trigger matches "Day N+" or "Day N "
// and promotes them to active when the user's post-op day >= N. Logs to
// changelog and surfaces an insight notification. No-op for users without
// a profiles.postop_date ("Day N" has nothing to count from).
export async function promoteDayMilestoneItems(
  userId: string,
): Promise<InsightRow[]> {
  const admin = createAdminClient();
  const { day: today, today: todayISO } = await getPostOpDay(admin, userId);
  if (today == null) return [];

  const { data: queued } = await admin
    .from("items")
    .select("id, name, review_trigger")
    .eq("user_id", userId)
    .eq("status", "queued")
    .not("review_trigger", "is", null);

  if (!queued || queued.length === 0) return [];

  // Match patterns like "Day 14+", "Day 21 ", "Day 14"
  const dayRegex = /\bDay\s+(\d+)\s*\+?/i;
  const ready: { id: string; name: string; trigger: string; day: number }[] = [];

  for (const item of queued) {
    const m = item.review_trigger?.match(dayRegex);
    if (!m) continue;
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n) && today >= n) {
      ready.push({
        id: item.id,
        name: item.name,
        trigger: item.review_trigger ?? "",
        day: n,
      });
    }
  }
  if (ready.length === 0) return [];

  // Promote
  for (const r of ready) {
    const { error: promoteErr } = await admin
      .from("items")
      .update({ status: "active", started_on: todayISO })
      .eq("id", r.id);
    if (promoteErr) console.error("day-milestone promote", promoteErr);
    await admin.from("changelog").insert({
      user_id: userId,
      date: todayISO,
      change_type: "promote",
      item_id: r.id,
      item_name: r.name,
      reasoning: `Auto-promoted: Day ${r.day}+ trigger fired (today is Day ${today}).`,
      triggered_by: "cron-day-milestone",
      approved_by_user: false,
    });
  }

  return [
    {
      user_id: userId,
      type: "day_milestone",
      title: `🎯 ${ready.length} item${ready.length === 1 ? "" : "s"} auto-activated for Day ${today}`,
      body: ready
        .map((r) => `- ${r.name} (was: ${r.trigger})`)
        .join("\n"),
      confidence: "high",
      status: "new",
    },
  ];
}

// ----- Reorder alerts -----
// For items marked `using` with days_supply + arrived_on set, flag when
// estimated depletion is within 7 days and no alert was sent yet.
export async function generateReorderAlerts(
  userId: string,
): Promise<InsightRow[]> {
  const admin = createAdminClient();
  const { data: using } = await admin
    .from("items")
    .select(
      "id, name, brand, dose, days_supply, arrived_on, reorder_alert_sent_at, purchase_url",
    )
    .eq("user_id", userId)
    .eq("purchase_state", "using")
    .not("days_supply", "is", null)
    .not("arrived_on", "is", null);

  if (!using || using.length === 0) return [];

  const now = Date.now();
  const WARN_WINDOW_DAYS = 7;
  const insights: InsightRow[] = [];
  const toMark: string[] = [];

  for (const i of using) {
    if (!i.arrived_on || !i.days_supply) continue;
    // Skip if alert already sent within the last 21 days (debounce re-alerts)
    if (i.reorder_alert_sent_at) {
      const last = new Date(i.reorder_alert_sent_at).getTime();
      if (now - last < 21 * 86400000) continue;
    }
    const arrived = new Date(i.arrived_on).getTime();
    const depletes = arrived + i.days_supply * 86400000;
    const daysLeft = Math.round((depletes - now) / 86400000);
    if (daysLeft > WARN_WINDOW_DAYS) continue;

    const urgency = daysLeft <= 0 ? "out now" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`;
    const parts = [i.brand, i.dose].filter(Boolean).join(" · ");
    insights.push({
      user_id: userId,
      type: "reorder_alert",
      title: `Reorder: ${i.name}`,
      body: `${urgency}${parts ? ` · ${parts}` : ""}${i.purchase_url ? `\nReorder: ${i.purchase_url}` : ""}`,
      confidence: "high",
      status: "new",
    });
    toMark.push(i.id);
  }

  if (toMark.length > 0) {
    await admin
      .from("items")
      .update({ reorder_alert_sent_at: new Date().toISOString() })
      .in("id", toMark);
  }

  return insights;
}

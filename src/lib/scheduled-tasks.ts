// Scheduled task generators. Called by /api/cron/daily once per day.
// Each function returns an array of InsightRow to insert.

import { createAdminClient } from "@/lib/supabase/admin";
import { daysSincePostOp, POSTOP_DATE_ZERO } from "@/lib/constants";
import { getAnthropic, MODELS } from "@/lib/anthropic";
import {
  buildContextForUser,
  contextToSystemPrompt,
} from "@/lib/context";
import type { Item } from "@/lib/types";

export type InsightRow = {
  user_id: string;
  type: string;
  title: string;
  body: string;
  confidence: "low" | "medium" | "high";
  status: "new";
};

// Day-milestone triggers: postOpDay → items that should activate
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
  const today = daysSincePostOp();
  const milestone = DAY_MILESTONES[today];
  if (!milestone) return [];

  const admin = createAdminClient();
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
  const zero = new Date(POSTOP_DATE_ZERO);
  const msPerDay = 1000 * 60 * 60 * 24;

  for (const item of (items ?? []) as Item[]) {
    if (item.schedule_rule?.frequency !== "cycle_8_2") continue;
    // Use started_on if present, otherwise post-op zero as anchor
    const anchor = item.started_on ? new Date(item.started_on) : zero;
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

// Biotin pause: 72h before any upcoming bloodwork review
export async function generateBiotinAlert(
  userId: string,
): Promise<InsightRow[]> {
  const admin = createAdminClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const threeDaysOut = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
  const target = threeDaysOut.toISOString().slice(0, 10);

  const { data } = await admin
    .from("reviews")
    .select("scheduled_date, phase_name")
    .eq("user_id", userId)
    .eq("scheduled_date", target);

  const bloodwork = (data ?? []).filter((r) =>
    /bloodwork|function health|labs?/i.test(r.phase_name),
  );
  if (bloodwork.length === 0) return [];

  return [
    {
      user_id: userId,
      type: "biotin_pause",
      title: "⚠️ Pause biotin starting today",
      body: `You have bloodwork scheduled in 3 days (${target}). Stop Hairpower Biotin now — it skews lab assays. Resume after the blood draw.`,
      confidence: "high",
      status: "new",
    },
  ];
}

// Generate ONE daily suggestion — an item Claude thinks Giovanni should consider adding or changing
export async function generateDailySuggestion(
  userId: string,
): Promise<InsightRow[]> {
  try {
    const ctx = await buildContextForUser(userId);
    const system = contextToSystemPrompt(ctx);
    const anthropic = getAnthropic();
    const res = await anthropic.messages.create({
      model: MODELS.chat,
      max_tokens: 400,
      system,
      messages: [
        {
          role: "user",
          content: `Pick exactly ONE actionable suggestion for Giovanni today. Pick from:
- Promoting a queued item whose trigger has fired
- Considering a back-burner item given current data
- Tweaking an existing active item's dose/timing
- Adding a new item not yet tracked but high-ROI

CRITERIA:
- Must meaningfully earn its spot (resist stack inflation)
- Must respect post-op day + hard NOs
- Prefer food/practice adds over new supplements when possible

Format (STRICT):
Title: <under 70 chars, imperative>
Body: <2-3 sentences including reasoning>

Do NOT include a proposal block. This is just a suggestion — the user can bring it into chat if they want to act on it.`,
        },
      ],
    });
    const text = res.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("\n")
      .trim();
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

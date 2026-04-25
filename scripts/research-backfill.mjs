// Server-side bulk research generator. Runs the same Claude pipeline as
// /api/items/[id]/research but iterates every item missing research,
// without needing the user to be logged into the app.
//
// Usage: node --experimental-strip-types scripts/research-backfill.mjs <USER_ID>

import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);

const USER_ID = process.argv[2];
if (!USER_ID) {
  console.error("Usage: node scripts/research-backfill.mjs <USER_ID>");
  process.exit(1);
}

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
const MODEL = "claude-sonnet-4-5";

// ---- Build user context (mirrors src/lib/context.ts) ----
const POSTOP_DATE_ZERO = "2026-04-17";
function daysSincePostOp() {
  const zero = new Date(POSTOP_DATE_ZERO);
  return Math.floor((Date.now() - zero.getTime()) / 86400000);
}

const HARD_NOS = [
  "Finasteride / Dutasteride (oral) — chosen out",
  "Topical minoxidil — chosen out",
  "Bitter orange / p-synephrine — bad with Testro-X + coffee + gym",
  "Ginkgo biloba — antiplatelet, post-op caution",
  "Aged cheese, cured meats, dark chocolate (histamine triggers)",
  "Sugar, dates, dried fruit, juice, honey (insulin/seb derm)",
  "Dairy (cheese, ice cream) — confirmed seb derm trigger + IGF-1",
  "Seed oils (canola, soy, sunflower, corn, vegetable, cottonseed, safflower)",
  "zuPoo (laxative, chronic use harmful)",
  "Complex Formula multi (cheap forms throughout)",
  "Standalone biotin in any other product (no double-dose)",
];

const GOALS = [
  "Protect grafts + preserve native hair",
  "Control seborrheic dermatitis",
  "High vitality + strong erections",
  "Deeper sleep",
  "Low systemic inflammation",
  "Sustained thermogenic energy",
  "Sustained cognition + focus",
  "Long-term longevity",
];

async function buildContext() {
  const dayPostOp = daysSincePostOp();
  const [itemsRes, profileRes] = await Promise.all([
    admin.from("items").select("*").eq("user_id", USER_ID).eq("status", "active"),
    admin
      .from("profiles")
      .select(
        "weight_kg, height_cm, age, biological_sex, activity_level, body_goal, meals_per_day, postop_date",
      )
      .eq("id", USER_ID)
      .maybeSingle(),
  ]);
  const activeItems = itemsRes.data ?? [];
  const profile = profileRes.data;

  let macros = null;
  if (profile?.weight_kg && profile.height_cm && profile.age && profile.biological_sex) {
    const base = 10 * profile.weight_kg + 6.25 * profile.height_cm - 5 * profile.age;
    const bmr = profile.biological_sex === "male" ? base + 5 : base - 161;
    const mult = { sedentary: 1.2, light: 1.375, moderate: 1.55, very_active: 1.725, extra: 1.9 };
    const tdee = bmr * (mult[profile.activity_level ?? "moderate"] ?? 1.55);
    const goalDelta = { lean: -0.15, maintain: 0, build: 0.1 };
    const calories = Math.round(tdee * (1 + (goalDelta[profile.body_goal ?? "maintain"] ?? 0)));
    let proteinPerKg = 1.8;
    if (profile.body_goal === "lean") proteinPerKg = 2.2;
    if (profile.body_goal === "build") proteinPerKg = 2.0;
    proteinPerKg += 0.3; // post-op
    const protein_g = Math.round(profile.weight_kg * proteinPerKg);
    const fat_g = Math.round((calories * 0.32) / 9);
    const carbs_g = Math.max(0, Math.round((calories - protein_g * 4 - fat_g * 9) / 4));
    macros = { calories, protein_g, fat_g, carbs_g };
  }

  return { dayPostOp, activeItems, macros };
}

function contextSystem(ctx) {
  const lines = [];
  lines.push(`You are Claude, the AI partner inside Giovanni's personal health app "Regimen".`);
  lines.push(``);
  lines.push(`# ABOUT GIOVANNI`);
  lines.push(`- 20-something male, runs Pinnacle SEO LLC in Florida`);
  lines.push(`- Day ${ctx.dayPostOp} post-op from 6,500-graft FUE hair transplant at Cosmedica Turkey, surgery 2026-04-17`);
  lines.push(`- Pre-op: AGA Norwood V-Va + comorbid seborrheic dermatitis`);
  lines.push(``);
  lines.push(`# GOALS (priority order)`);
  GOALS.forEach((g, i) => lines.push(`${i + 1}. ${g}`));
  lines.push(``);
  lines.push(`# HARD NOs`);
  HARD_NOS.forEach((n) => lines.push(`- ${n}`));
  lines.push(``);
  if (ctx.macros) {
    lines.push(`# DAILY MACROS: ${ctx.macros.calories} kcal · ${ctx.macros.protein_g}g P · ${ctx.macros.fat_g}g F · ${ctx.macros.carbs_g}g C`);
    lines.push(``);
  }
  lines.push(`# CURRENT ACTIVE STACK (${ctx.activeItems.length} items)`);
  for (const i of ctx.activeItems) {
    lines.push(`- ${i.name}${i.brand ? ` (${i.brand})` : ""}${i.dose ? ` — ${i.dose}` : ""} · ${i.timing_slot} · ${i.category}`);
  }
  lines.push(``);
  lines.push(`# BEHAVIOR RULES`);
  lines.push(`1. Day 8–14 antiplatelet caution: high-dose omega-3, curcumin, vitamin E >400 IU, garlic pills, ginkgo all need flagging.`);
  lines.push(`2. Triggers: (a) insulin spikes (sugar/dates/dried fruit/honey) (b) histamine (aged cheese/cured meats/dark chocolate). Dairy hits both.`);
  lines.push(`3. Biotin pause 72hr before bloodwork.`);
  lines.push(`4. Speak to Giovanni directly ("you" / "your"). Don't say "the user."`);
  return lines.join("\n");
}

const RESEARCH_SYSTEM_SUFFIX = (dayPostOp) => `

# RESEARCH GENERATION MODE
Generate two fields. Respond with VALID JSON ONLY — no markdown fences, no commentary.

{
  "usage_notes": "1–3 sentences OR 2–5 numbered steps if procedural (washing routine, microneedling, etc.). Concrete + actionable. Speak to Giovanni directly. Examples:\\n- 'Take with breakfast fat (eggs/EVOO) for 4–8× absorption. Pair with K2 to direct calcium correctly.'\\n- '1. Wet scalp. 2. Apply ZPT shampoo, leave 2 min. 3. Rinse. 4. Pat dry — do not rub. 5. Apply serum to damp scalp.'",
  "research_summary": "2–3 paragraphs. (a) Mechanism — how it works biologically. (b) Trial data — at least one cited RCT/study with author + year + key result. (c) Why it is in YOUR stack at Day-${dayPostOp} post-op — tie to your goals + flag any interactions with other active items."
}`;

function extractJson(raw) {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) return raw.slice(start, end + 1);
  return raw.trim();
}

async function generateForItem(item, system) {
  const userMsg = `Item:
Name: ${item.name}
${item.brand ? `Brand: ${item.brand}\n` : ""}${item.dose ? `Dose: ${item.dose}\n` : ""}Type: ${item.item_type}
Timing: ${item.timing_slot}
Goals: ${(item.goals ?? []).join(", ") || "none"}
Status: ${item.status}
${item.notes ? `Notes: ${item.notes}\n` : ""}
Generate usage_notes + research_summary. JSON only.`;

  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system,
    messages: [{ role: "user", content: userMsg }],
  });
  let raw = "";
  for (const b of res.content) if (b.type === "text") raw += b.text;
  const parsed = JSON.parse(extractJson(raw));
  return {
    usage_notes: parsed.usage_notes ? String(parsed.usage_notes).slice(0, 800) : null,
    research_summary: parsed.research_summary
      ? String(parsed.research_summary).slice(0, 4000)
      : null,
  };
}

async function main() {
  console.log(`Building context for user ${USER_ID}...`);
  const ctx = await buildContext();
  const system = contextSystem(ctx) + RESEARCH_SYSTEM_SUFFIX(ctx.dayPostOp);
  console.log(`Day ${ctx.dayPostOp} post-op · ${ctx.activeItems.length} active items`);

  const { data: missingItems } = await admin
    .from("items")
    .select("*")
    .eq("user_id", USER_ID)
    .is("research_generated_at", null)
    .in("status", ["active", "queued"])
    .order("status")
    .order("name");

  if (!missingItems || missingItems.length === 0) {
    console.log("✓ No items missing research.");
    return;
  }
  console.log(`\nFound ${missingItems.length} items missing research. Starting...\n`);

  let succeeded = 0;
  let failed = 0;
  const startTime = Date.now();

  for (let i = 0; i < missingItems.length; i++) {
    const item = missingItems[i];
    const idx = `[${i + 1}/${missingItems.length}]`;
    process.stdout.write(`${idx} ${item.name.padEnd(40)} `);
    try {
      const t0 = Date.now();
      const { usage_notes, research_summary } = await generateForItem(item, system);
      const { error } = await admin
        .from("items")
        .update({
          usage_notes,
          research_summary,
          research_generated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
      if (error) throw error;
      const dt = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`✓ (${dt}s)`);
      succeeded++;
    } catch (e) {
      console.log(`✗ ${e.message}`);
      failed++;
    }
  }

  const totalMin = ((Date.now() - startTime) / 60000).toFixed(1);
  console.log(`\n──────────────────────────────`);
  console.log(`✅ Done: ${succeeded} succeeded · ${failed} failed · ${totalMin}min total`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});

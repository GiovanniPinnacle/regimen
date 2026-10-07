// Seed a DEMO user (demo@regimen.test) with ~75 days of realistic,
// internally consistent fake history so every signed-in page renders.
//
// Usage:
//   node --env-file=.env.local scripts/seed-demo-user.mjs           # seed if empty, else print counts
//   node --env-file=.env.local scripts/seed-demo-user.mjs --reset   # wipe demo rows + reseed
//
// Safety: every delete/update is scoped to the demo user's id, which is
// resolved from the auth user whose email is exactly DEMO_EMAIL. Rows of
// any other user are never touched.
//
// Deterministic: a seeded PRNG drives every random choice, and all dates
// are relative to "today", so reruns on the same day produce identical data.

import { createClient } from "@supabase/supabase-js";
import {
  SEED_ITEMS,
  QUEUED_ITEMS,
  BACKBURNER_ITEMS,
  HARD_NOS,
} from "../src/lib/seed.ts";
import { SLEEP_RESTORATION_21 } from "../src/lib/protocols/sleep-restoration-21.ts";

const DEMO_EMAIL = "demo@regimen.test";
const RESET = process.argv.includes("--reset");
const WINDOW_DAYS = 75; // day index 0..74, 74 = today
const TODAY_IDX = WINDOW_DAYS - 1;
const TZ_OFFSET = "-04:00"; // America/New_York (EDT) for logged_at timestamps
// seed.ts hard-codes calendar dates authored around this anchor; we shift
// them so the relationships hold relative to whatever "today" is.
const SEED_ANCHOR = "2026-10-06";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (run with --env-file=.env.local)");
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

// ---------------------------------------------------------------- PRNG
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261006);
const chance = (p) => rand() < p;
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (lo, hi) => lo + rand() * (hi - lo);
const intBetween = (lo, hi) => Math.floor(between(lo, hi + 1));
function gauss(sd = 1) {
  const u = Math.max(rand(), 1e-9);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sd;
}
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const r1 = (v) => Math.round(v * 10) / 10;

// ---------------------------------------------------------------- dates
function isoLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function parseISO(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}
function addDays(s, n) {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return isoLocal(d);
}
function daysBetween(a, b) {
  return Math.round((parseISO(b) - parseISO(a)) / 86400000);
}
const TODAY = isoLocal(new Date());
const WINDOW_START = addDays(TODAY, -TODAY_IDX);
const dateOf = (idx) => addDays(WINDOW_START, idx);
const idxOf = (date) => daysBetween(WINDOW_START, date);
const dow = (date) => parseISO(date).getDay(); // 0 Sun .. 6 Sat
const isWeekend = (date) => [0, 6].includes(dow(date));
const ts = (date, hh, mm = 0) =>
  `${date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00${TZ_OFFSET}`;
function tsMinutes(date, minutesFromMidnight) {
  let d = date;
  let m = Math.round(minutesFromMidnight);
  while (m < 0) { m += 1440; d = addDays(d, -1); }
  while (m >= 1440) { m -= 1440; d = addDays(d, 1); }
  return ts(d, Math.floor(m / 60), m % 60);
}
const SHIFT = daysBetween(SEED_ANCHOR, TODAY);

// ---------------------------------------------------------------- story
// Day indexes (0 = 74 days ago, 74 = today)
const STORY = {
  roughPatch: [33, 40], // work trip + deadline: worse sleep, adherence, stress
  magStart: 30, // UMZU Daily Magnesium started → HRV climbs over ~3 weeks
  protocolStart: 62, // Sleep Restoration 21 enrolled (day 12 of 21 today)
  panel1: 6,
  panel2: 66,
  pumpkinRanOut: TODAY_IDX - 3,
};
const inRough = (i) => i >= STORY.roughPatch[0] && i <= STORY.roughPatch[1];

// Items that start mid-window so before/after comparisons work.
//
// Spaced so each before/after read is clean: magnesium is the ONLY start
// within ±21 days of STORY.magStart (its HRV ramp runs magStart → +21, so
// nothing else may start in [9, 51]). Early starts sit before that window;
// later ones start after the HRV plateau and ≥4 days from each other and
// from the protocol's start days (62, 69).
const MID_WINDOW_START = {
  "collagen": 1,
  "l-theanine": 8, // tried first for 3am wakeups; magnesium is what worked
  "umzu-daily-mag": STORY.magStart,
  "kimchi": 52,
  "creatine": 57,
  // Sleep Restoration 21 enrolls at 62 (and starts more items at 69)
  "mouth-tape": 66,
};
// Guard the story: fail loudly if a future edit crowds magnesium's window.
for (const [sid, idx] of Object.entries(MID_WINDOW_START)) {
  if (sid !== "umzu-daily-mag" && Math.abs(idx - STORY.magStart) <= 21) {
    throw new Error(`${sid} starts at ${idx}, inside magnesium's ±21-day window`);
  }
}

// Unit cost + supply for the costs / purchases pages.
const COSTS = {
  "seed-ds01": [49.99, 30, "Seed"],
  "vit-d3": [16.5, 120, "Amazon"],
  "umzu-daily-k": [29.99, 60, "UMZU"],
  "umzu-tocotrienols": [34.99, 60, "UMZU"],
  "umzu-sensolin": [49.99, 30, "UMZU"],
  "hp-saw-palmetto": [32, 45, "Hairpower"],
  "hp-biotin": [24, 60, "Hairpower"],
  "holy-basil-am": [27.95, 60, "Amazon"],
  "holy-basil-pm": [27.95, 60, "Amazon"],
  "pumpkin-seed-oil": [19.99, 60, "iHerb"],
  "mega-igg": [74, 30, "Amazon"],
  "sunfiber": [29.95, 30, "Amazon"],
  "zinc-carnosine-am": [22.5, 60, "Thorne"],
  "zinc-carnosine-pm": [0.01, 999, "Thorne"], // same bottle as AM — effectively free
  "collagen": [43, 28, "Amazon"],
  "l-citrulline": [24.99, 60, "Amazon"],
  "creatine": [29.99, 90, "Thorne"],
  "l-glutamine-am": [31.99, 50, "Amazon"],
  "l-glutamine-pm": [0.01, 999, "Amazon"],
  "umzu-testrox": [59.99, 30, "UMZU"],
  "umzu-daily-mag": [29.99, 30, "UMZU"],
  "glycine": [17.99, 90, "Amazon"],
  "l-theanine": [21, 60, "Thorne"],
  "tart-cherry": [24, 30, "Amazon"],
  "cosmedica-shampoo": [38, 60, "Cosmedica"],
  "saline-mist": [12.99, 30, "Amazon"],
  "hocl-spray": [36, 90, "BLDG"],
  "mouth-tape": [14.99, 30, "Amazon"],
  "bone-broth": [64, 14, "Kettle & Fire"],
  "lifeboost-coffee": [44, 21, "Lifeboost"],
  "grassfed-beef": [89, 14, "ButcherBox"],
  "pasture-eggs": [8.49, 7, "Whole Foods"],
  "blueberries": [6.99, 5, "Whole Foods"],
  "kimchi": [9.99, 10, "Whole Foods"],
  "sleep-mask": [34, 365, "Manta"],
  "silk-pillowcase": [49, 365, "Amazon"],
  "oura-ring": [5.99, 30, "Oura"], // membership
  "stelo-cgm": [99, 30, "Dexcom"],
  "q-omega3": [46.95, 60, "Thorne"],
  "q-curcumin": [44, 60, "Thorne"],
};

// ---------------------------------------------------------------- helpers
async function insertChunked(table, rows, { select } = {}) {
  const out = [];
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    let q = admin.from(table).insert(chunk);
    if (select) q = q.select(select);
    const { data, error } = await q;
    if (error) throw new Error(`${table} insert failed: ${error.message}`);
    if (data) out.push(...data);
  }
  return out;
}

const USER_TABLES = [
  "achievements", "affiliate_clicks", "affiliate_conversions", "biomarkers",
  "cgm_readings", "claude_conversations", "daily_checkins", "data_imports",
  "insights", "intake_log", "item_reactions", "stack_log", "changelog",
  "voice_memos", "wishlist_items", "recipes", "reviews", "scalp_photos",
  "symptom_log", "oura_daily", "meal_log", "protocol_enrollments",
  "push_subscriptions", "upgrade_interest", "user_feedback", "llm_usage",
  "items", // last — other tables reference it
];

async function findOrCreateDemoUser() {
  for (let page = 1; page < 100; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data.users.find((u) => (u.email ?? "").toLowerCase() === DEMO_EMAIL);
    if (found) return { user: found, created: false };
    if (data.users.length < 1000) break;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email: DEMO_EMAIL,
    email_confirm: true,
    user_metadata: { demo: true },
  });
  if (error) throw error;
  return { user: data.user, created: true };
}

async function countRows(uid) {
  const counts = {};
  for (const t of [...USER_TABLES].reverse()) {
    const { count, error } = await admin
      .from(t)
      .select("*", { count: "exact", head: true })
      .eq("user_id", uid);
    counts[t] = error ? `n/a (${error.message})` : count;
  }
  const { count: pc } = await admin
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("id", uid);
  counts.profiles = pc;
  return counts;
}

async function wipe(uid) {
  for (const t of USER_TABLES) {
    const { error } = await admin.from(t).delete().eq("user_id", uid);
    if (error) console.warn(`  wipe ${t}: ${error.message}`);
  }
}

// ================================================================ main
const { user, created } = await findOrCreateDemoUser();
const UID = user.id;
if (!/^[0-9a-f-]{36}$/i.test(UID) || (user.email ?? "").toLowerCase() !== DEMO_EMAIL) {
  throw new Error("Refusing to continue: demo user id/email check failed");
}
console.log(`Demo user ${DEMO_EMAIL} → ${UID}${created ? " (created)" : ""}`);
console.log(`Window ${WINDOW_START} → ${TODAY} (${WINDOW_DAYS} days)`);

{
  const { count } = await admin
    .from("items")
    .select("*", { count: "exact", head: true })
    .eq("user_id", UID);
  if (count && !RESET) {
    console.log(`Demo user already has ${count} items — nothing to do. Pass --reset to rebuild.`);
    console.table(await countRows(UID));
    process.exit(0);
  }
  if (RESET) {
    console.log("Resetting demo rows…");
    await wipe(UID);
  }
}

// ---------------------------------------------------------------- profile
const POSTOP = addDays("2026-04-17", SHIFT);
{
  const about_me = {
    top_goals:
      "1. Protect + grow the hair transplant (FUE, April)\n2. Sleep 7.5h with HRV back above 45\n3. Get bloodwork into optimal ranges (vit D, ApoB, fasting glucose)",
    why_doing_this:
      "Turned 34 and my labs came back borderline on a few things. I want to feel sharp at work and stop running on caffeine.",
    family_history: "Father: type 2 diabetes at 55, high LDL. Grandfather: heart attack at 68. Male-pattern hair loss on both sides.",
    past_diagnoses: "Mild seborrheic dermatitis (scalp). Borderline pre-diabetes flag in 2025 (HbA1c 5.7).",
    current_medications: "None. Topical minoxidil discussed with surgeon, not started.",
    allergies_sensitivities: "Mild lactose intolerance. Ashwagandha made me flat/low mood.",
    communication_style: "Tight and direct. Give me the one change that matters most, with the why in a sentence.",
    current_stressors: "Product launch at work through Q4, two work trips a month.",
    chronic_issues: "Scalp flaking/itch when stressed. Wake up at 3am a couple nights a week.",
    past_surgeries: `FUE hair transplant (${POSTOP}), 2,400 grafts, crown + hairline.`,
    typical_wake: "6:45 AM",
    typical_bed: "10:45 PM",
    work_type: "Product manager, remote with frequent travel. Mostly desk.",
    resting_heart_rate: "56-58",
    hrv_baseline: "~38 ms (Oura, 30-day avg before magnesium)",
    bp_baseline: "122/78",
    body_fat_estimate: "~18%",
    hard_food_dislikes: "Liver, olives",
    cuisine_preferences: "Mediterranean, Korean, Mexican",
    cooking_ability: "Comfortable — batch cooks Sunday",
    exercise_preferences: "Lifting 3x/week, zone 2 on the bike, weekend hikes",
    goal_3mo: "HRV avg 45+, sleep score 85+, seb derm quiet without Rx shampoo",
    goal_6mo: "Visible density at the crown, ApoB under 90",
    goal_12mo: "Fully healed transplant, deadlift 2x bodyweight, HbA1c 5.3",
    values: "Consistency over intensity. Evidence over hype.",
    what_success_looks_like: "Wake up without an alarm and not need coffee to think.",
    current_wins: "Magnesium + earlier dinners moved HRV ~8ms. Labs improved across the board in the second panel.",
    current_blockers: "Travel weeks wreck everything — sleep, food, adherence.",
    travel_pattern: "2 short work trips a month",
    kitchen_access: "Full kitchen at home, hotel on the road",
    relationship_status: "Partnered",
    social_context: "Partner is supportive; does the sleep protocol with me.",
  };
  const profile = {
    id: UID,
    email: DEMO_EMAIL,
    display_name: "Alex Rivera",
    postop_date: POSTOP,
    goals: ["hair", "sleep", "gut", "metabolic", "recovery", "longevity"],
    hard_nos: HARD_NOS,
    timezone: "America/New_York",
    weight_kg: 79.5,
    height_cm: 180,
    age: 34,
    biological_sex: "male",
    activity_level: "moderate",
    body_goal: "build",
    meals_per_day: 3,
    water_target_oz: 96,
    about_me,
  };
  const { error } = await admin.from("profiles").upsert(profile, { onConflict: "id" });
  if (error) throw new Error(`profiles upsert: ${error.message}`);
}

// ---------------------------------------------------------------- items
const allSeeds = [...SEED_ITEMS, ...QUEUED_ITEMS, ...BACKBURNER_ITEMS];
const itemMeta = {}; // seed_id → { startIdx, endIdx, row }
const itemRows = allSeeds.map((s) => {
  const sid = s.seed_id ?? s.id;
  let started_on = s.started_on ? addDays(s.started_on, SHIFT) : null;
  let ends_on = s.ends_on ? addDays(s.ends_on, SHIFT) : null;
  let status = s.status;
  if (status === "active" && !started_on) started_on = addDays(WINDOW_START, -intBetween(14, 140));
  if (MID_WINDOW_START[sid] != null) started_on = dateOf(MID_WINDOW_START[sid]);
  if (status === "active" && ends_on && ends_on < TODAY) status = "retired";

  const cost = COSTS[sid];
  const isActive = status === "active";
  let purchase_state = null;
  if (isActive && ["supplement", "topical", "food", "device", "gear"].includes(s.item_type)) purchase_state = "using";
  let ordered_on = null;
  let arrived_on = null;
  if (sid === "pumpkin-seed-oil") purchase_state = "needed";
  if (sid === "sunfiber") { purchase_state = "shipped"; ordered_on = addDays(TODAY, -2); }
  if (sid === "q-omega3") { purchase_state = "ordered"; ordered_on = addDays(TODAY, -1); }
  if (sid === "q-curcumin") { purchase_state = "arrived"; ordered_on = addDays(TODAY, -8); arrived_on = addDays(TODAY, -3); }
  if (sid === "creatine") { arrived_on = started_on; ordered_on = addDays(started_on, -4); }

  const created_at = started_on && started_on <= TODAY
    ? ts(started_on, 8, 5)
    : ts(dateOf(intBetween(0, 50)), 20, 15);

  const row = {
    user_id: UID,
    seed_id: sid,
    name: s.name,
    brand: s.brand ?? null,
    dose: s.dose ?? null,
    unit: s.unit ?? null,
    timing_slot: s.timing_slot,
    schedule_rule: s.schedule_rule,
    category: s.category,
    item_type: s.item_type,
    goals: s.goals,
    started_on,
    ends_on,
    review_trigger: s.review_trigger ?? null,
    status,
    notes: s.notes ?? null,
    purchase_url: s.purchase_url ?? null,
    owned: isActive ? sid !== "pumpkin-seed-oil" : null,
    purchase_state,
    ordered_on,
    arrived_on,
    unit_cost: cost ? cost[0] : null,
    days_supply: cost ? cost[1] : null,
    vendor: cost ? cost[2] : null,
    list_price_cents: cost ? Math.round(cost[0] * 100) : null,
    created_at,
  };
  if (sid === "l-theanine") row.dose = "200mg";
  return row;
});

// Sleep Restoration 21 enrollment — mirror /api/protocols/enroll, adopting
// overlapping seed items rather than duplicating them.
const PROTO = SLEEP_RESTORATION_21;
const PROTO_START = dateOf(STORY.protocolStart);
const PROTO_ADOPT = {
  "morning-sun": "morning-sun",
  "room-temp-cool": "bedroom-cool",
  "magnesium-glycinate-sleep": "umzu-daily-mag",
  "glycine-sleep": "glycine",
  "no-screens-30": "no-screens-pre-bed",
  "eye-mask-earplugs": "sleep-mask",
  "apigenin": "bb-apigenin",
};
const protoDay = TODAY_IDX - STORY.protocolStart;
for (const pi of PROTO.items) {
  const startedOn = addDays(PROTO_START, pi.starts_on_day ?? 0);
  const adoptSid = PROTO_ADOPT[pi.key];
  if (adoptSid) {
    const r = itemRows.find((x) => x.seed_id === adoptSid);
    r.from_protocol_slug = PROTO.slug;
    r.from_protocol_item_key = pi.key;
    if (r.status !== "active") {
      r.status = (pi.starts_on_day ?? 0) <= protoDay ? "active" : "queued";
      r.started_on = startedOn;
      r.created_at = ts(PROTO_START, 21, 0);
    }
    continue;
  }
  itemRows.push({
    user_id: UID,
    seed_id: `${PROTO.slug}__${pi.key}`,
    name: pi.name,
    brand: pi.brand ?? null,
    dose: pi.dose ?? null,
    timing_slot: pi.timing_slot,
    schedule_rule: { frequency: pi.schedule_rule ?? "daily" },
    category: pi.category,
    item_type: pi.item_type,
    goals: pi.goals,
    started_on: startedOn,
    ends_on: null,
    review_trigger: pi.review_trigger ?? null,
    status: (pi.starts_on_day ?? 0) <= protoDay ? "active" : "queued",
    usage_notes: pi.usage_notes ?? null,
    research_summary: pi.research_summary ?? null,
    sort_order: pi.sort_order ?? null,
    vendor: pi.vendor ?? null,
    affiliate_url: pi.affiliate_url ?? null,
    list_price_cents: pi.list_price_cents ?? null,
    from_protocol_slug: PROTO.slug,
    from_protocol_item_key: pi.key,
    companion_instruction: pi.companion_instruction ?? null,
    created_at: ts(PROTO_START, 21, 0),
  });
}

// Normalise keys so every row in a bulk insert has identical columns.
{
  const allKeys = new Set(itemRows.flatMap((r) => Object.keys(r)));
  for (const r of itemRows) for (const k of allKeys) if (!(k in r)) r[k] = null;
}
const insertedItems = await insertChunked("items", itemRows, { select: "id, seed_id, name, status, item_type, timing_slot, schedule_rule, started_on, ends_on" });
const bySid = Object.fromEntries(insertedItems.map((r) => [r.seed_id, r]));
const idOf = (sid) => bySid[sid]?.id;

// ---------------------------------------------------------------- stack_log
const MISS_REASONS = [
  "Forgot — left the pill case at home",
  "Skipped — late night, went straight to bed",
  "Upset stomach this morning",
  "Ran late for a call",
  "Not hungry, skipped breakfast",
  "Out at dinner, didn't have it with me",
];
const FOOD_SWAPS = [
  "Swapped: Greek yogurt + granola",
  "Swapped: airport breakfast sandwich",
  "Swapped: chicken burrito bowl",
  "Swapped: protein bar",
];
const TRAIN_DOW = new Set([1, 3, 5]); // Mon/Wed/Fri lifting
const isTrainDay = (i) => {
  const d = dateOf(i);
  if (inRough(i)) return dow(d) === 3;
  return TRAIN_DOW.has(dow(d)) || (dow(d) === 6 && i % 2 === 0);
};
// Per-day "how is today going" factor — a few off days scattered around.
const dayOff = Array.from({ length: WINDOW_DAYS }, () => chance(0.06));

function scheduledOn(item, i) {
  const date = dateOf(i);
  const f = item.schedule_rule?.frequency ?? "daily";
  const sid = item.seed_id;
  switch (f) {
    case "daily":
      return true;
    case "cycle_8_2": {
      const since = daysBetween(item.started_on, date);
      return ((since % 10) + 10) % 10 < 8;
    }
    case "weekly":
      if (sid === "zone2-cardio") return [2, 4, 0].includes(dow(date));
      if (sid === "wild-salmon") return [1, 4].includes(dow(date));
      if (sid === "tart-cherry") return [3, 0].includes(dow(date));
      return dow(date) === 6;
    case "situational":
      return sid === "l-citrulline" ? isTrainDay(i) : false;
    case "as_needed":
      if (sid === "umzu-sensolin") return dow(date) !== 0 && i % 3 !== 0;
      if (sid === "hocl-spray") return i % 9 === 0;
      return false;
    default:
      return false; // ongoing — nothing to check off
  }
}

const SLOT_TIME = {
  pre_breakfast: [6, 55], breakfast: [7, 40], pre_workout: [11, 50],
  lunch: [12, 45], dinner: [19, 10], pre_bed: [22, 15], ongoing: [13, 0],
  situational: [15, 0],
};
const TODAY_SLOTS = new Set(["pre_breakfast", "breakfast"]);
const panelDays = [STORY.panel1, STORY.panel2];

const stackRows = [];
for (const it of insertedItems) {
  if (!it.started_on) continue;
  const startIdx = Math.max(0, idxOf(it.started_on));
  const endIdx = it.ends_on ? Math.min(TODAY_IDX, idxOf(it.ends_on)) : TODAY_IDX;
  if (it.status === "queued" || it.status === "backburner") continue;
  for (let i = startIdx; i <= endIdx; i++) {
    if (!scheduledOn(it, i)) continue;
    const date = dateOf(i);
    if (i === TODAY_IDX && !TODAY_SLOTS.has(it.timing_slot)) continue;

    let taken;
    let reason = null;
    // Deliberate, story-driven misses first
    if (it.seed_id === "hp-biotin" && panelDays.some((p) => i >= p - 3 && i < p)) {
      taken = false;
      reason = "Paused 72h before bloodwork";
    } else if (it.seed_id === "pumpkin-seed-oil" && i >= STORY.pumpkinRanOut) {
      if (i === TODAY_IDX) continue;
      taken = false;
      reason = "Ran out — need to reorder";
    } else {
      let p = 0.93;
      if (isWeekend(date)) p -= 0.1;
      if (inRough(i)) p -= 0.3;
      if (dayOff[i]) p -= 0.35;
      if (it.timing_slot === "pre_bed") p -= 0.04;
      if (it.timing_slot === "dinner" && dow(date) === 5) p -= 0.08;
      if (it.item_type === "food") p += 0.03;
      if (i === TODAY_IDX) p = 0.97;
      taken = chance(clamp(p, 0.3, 0.99));
      if (!taken && chance(0.45)) {
        if (it.item_type === "food") reason = pick(FOOD_SWAPS);
        else if (inRough(i)) reason = "Traveling — work trip, didn't pack it";
        else reason = pick(MISS_REASONS);
      }
    }
    const [hh, mm] = SLOT_TIME[it.timing_slot] ?? [12, 0];
    stackRows.push({
      user_id: UID,
      date,
      item_id: it.id,
      taken,
      skipped_reason: reason,
      logged_at: tsMinutes(date, hh * 60 + mm + intBetween(-20, 35)),
    });
  }
}
await insertChunked("stack_log", stackRows);

// ---------------------------------------------------------------- oura_daily
const oura = []; // also used to drive check-ins / symptoms
const ouraByIdx = {};
for (let i = 0; i <= TODAY_IDX; i++) {
  const date = dateOf(i);
  const mag = i >= STORY.magStart ? Math.min(1, (i - STORY.magStart) / 21) : 0;
  const proto = i >= STORY.protocolStart ? Math.min(1, (i - STORY.protocolStart) / 10) : 0;
  const rough = inRough(i);
  const weekendMorning = [0, 6].includes(dow(date)); // Fri/Sat night drinks
  const hrv = clamp(38 + 9 * mag + 3 * proto - (rough ? 8 : 0) - (weekendMorning ? 3 : 0) + gauss(3.5), 22, 70);
  const rhr = clamp(58 - 3 * mag - 1.5 * proto + (rough ? 3 : 0) + (weekendMorning ? 1.5 : 0) + gauss(1.2), 48, 68);
  const total = clamp(402 + 14 * mag + 20 * proto - (rough ? 48 : 0) + (weekendMorning ? 15 : 0) + gauss(24), 290, 520);
  const deep = clamp(total * (0.18 + 0.02 * mag) + gauss(8), 40, 130);
  const rem = clamp(total * 0.23 + gauss(10), 50, 140);
  const sleepScore = clamp(Math.round(63 + (total - 360) / 4.5 + (hrv - 38) * 0.45 + gauss(3)), 48, 96);
  const readiness = clamp(Math.round(72 + (hrv - 36) * 0.8 - (rhr - 55) * 1.3 + (total - 400) / 14 + gauss(3)), 45, 97);
  const temp = r1(gauss(0.14) + (rough ? 0.35 : 0)) / 1;
  const bedMin = 22 * 60 + 40 + (weekendMorning ? 50 : 0) + (rough ? 55 : 0) - 15 * proto + gauss(18);
  const bedtime_start = tsMinutes(addDays(date, -1), bedMin);
  const wake_time = tsMinutes(addDays(date, -1), bedMin + total + 28 + gauss(6));
  const row = {
    user_id: UID,
    date,
    readiness,
    hrv: Math.round(hrv),
    rhr: Math.round(rhr),
    deep_sleep_min: Math.round(deep),
    rem_sleep_min: Math.round(rem),
    total_sleep_min: Math.round(total),
    temp_deviation: Math.round(temp * 100) / 100,
    sleep_score: sleepScore,
    bedtime_start,
    wake_time,
  };
  ouraByIdx[i] = row;
  // Ring on the charger a few nights
  if ([17, 44, 58].includes(i)) continue;
  oura.push(row);
}
await insertChunked("oura_daily", oura);

// ---------------------------------------------------------------- daily_checkins + symptom_log
const BREAKFASTS = [
  { t: "3 pasture eggs, avocado, sourdough, blueberries", cal: 610, p: 28, f: 38, c: 42 },
  { t: "Greek yogurt, blueberries, walnuts, collagen in coffee", cal: 480, p: 42, f: 20, c: 34 },
  { t: "Bone broth + 3-egg scramble with spinach and feta", cal: 520, p: 38, f: 34, c: 10 },
  { t: "Protein oats (whey, oats, berries, almond butter)", cal: 590, p: 40, f: 18, c: 66 },
];
const LUNCHES = [
  { t: "Grass-fed beef bowl — rice, kimchi, cucumber, sesame", cal: 760, p: 48, f: 30, c: 70 },
  { t: "Big salad with grilled chicken, olive oil, chickpeas", cal: 640, p: 52, f: 32, c: 36 },
  { t: "Salmon poke bowl", cal: 690, p: 42, f: 22, c: 78 },
  { t: "Turkey + avocado wrap, side of fruit", cal: 610, p: 40, f: 24, c: 58 },
  { t: "Leftover beef chili with sweet potato", cal: 700, p: 46, f: 26, c: 62 },
];
const DINNERS = [
  { t: "Wild salmon, roasted broccoli, quinoa", cal: 720, p: 50, f: 30, c: 52 },
  { t: "Grass-fed burger (no bun), sweet potato fries, salad", cal: 840, p: 52, f: 48, c: 50 },
  { t: "Chicken thighs, rice, sautéed greens", cal: 780, p: 54, f: 30, c: 66 },
  { t: "Steak tacos with corn tortillas, pico, guac", cal: 860, p: 50, f: 42, c: 64 },
  { t: "Korean beef bulgogi with rice + kimchi", cal: 820, p: 48, f: 30, c: 82 },
];
const TRAVEL_MEALS = [
  { t: "Airport chicken sandwich + chips", cal: 920, p: 38, f: 42, c: 96 },
  { t: "Hotel buffet — eggs, bacon, pastry", cal: 780, p: 32, f: 46, c: 58 },
  { t: "Client dinner — pasta, 2 glasses of wine", cal: 1150, p: 36, f: 44, c: 120 },
];
const SNACKS = [
  { t: "Apple + almond butter", cal: 290, p: 7, f: 16, c: 30 },
  { t: "Whey shake with water", cal: 130, p: 25, f: 2, c: 3 },
  { t: "Beef jerky + handful of almonds", cal: 300, p: 22, f: 18, c: 10 },
  { t: "Cottage cheese + berries", cal: 220, p: 24, f: 5, c: 18 },
];
const WORKOUTS = {
  1: "Pull day — trap bar DL 3x5 @ 315, pull-ups 4x8, rows 3x10. RPE 8.",
  3: "Push day — bench 4x6 @ 205, OHP 3x8, dips 3x12. RPE 7-8.",
  5: "Legs — back squat 4x6 @ 255, RDL 3x8, lunges 3x10. RPE 8.",
  6: "Zone 2 bike 45 min + mobility 15 min",
};

const checkins = [];
const symptoms = [];
const intake = [];
const mealPlan = {}; // idx → {breakfast, lunch, dinner}
for (let i = 0; i <= TODAY_IDX; i++) {
  const date = dateOf(i);
  const o = ouraByIdx[i];
  const rough = inRough(i);
  const isToday = i === TODAY_IDX;
  const moodBase = 3 + (o.readiness - 72) / 12 + (rough ? -0.8 : 0);
  const mood = clamp(Math.round(moodBase + gauss(0.5)), 1, 5);
  const energy = clamp(Math.round(moodBase + gauss(0.6)), 1, 5);
  const stress = clamp(Math.round(2.4 + (rough ? 1.8 : 0) + (dow(date) === 1 ? 0.4 : 0) + gauss(0.6)), 1, 5);

  const bfast = rough ? pick(TRAVEL_MEALS) : pick(BREAKFASTS);
  const lunch = rough ? pick(TRAVEL_MEALS) : pick(LUNCHES);
  const dinner = rough ? pick(TRAVEL_MEALS) : pick(DINNERS);
  mealPlan[i] = { bfast, lunch, dinner };

  if (chance(isToday ? 1 : 0.88)) {
    checkins.push({
      user_id: UID, date, checkin_window: "morning", mood, energy,
      notes: o.sleep_score < 65 ? pick(["Woke at 3am, took a while to fall back asleep", "Groggy — late night", "Rough night, head foggy"]) : (chance(0.15) ? pick(["Felt great, up before the alarm", "Solid sleep", "Slight headache, drinking water"]) : null),
      created_at: ts(date, 7, intBetween(0, 50)), updated_at: ts(date, 7, 55),
    });
  }
  if (chance(isToday ? 1 : 0.6)) {
    checkins.push({ user_id: UID, date, checkin_window: "breakfast", meal_text: bfast.t, energy: clamp(energy + (chance(0.3) ? 1 : 0), 1, 5), created_at: ts(date, 8, 30), updated_at: ts(date, 8, 30) });
  }
  if (!isToday && isTrainDay(i) && chance(0.85)) {
    checkins.push({ user_id: UID, date, checkin_window: "workout", workout_text: rough ? "Hotel gym — 30 min full body circuit" : (WORKOUTS[dow(date)] ?? "Lift + 20 min walk"), created_at: ts(date, 12, 40), updated_at: ts(date, 12, 40) });
  }
  if (!isToday && chance(0.55)) {
    checkins.push({ user_id: UID, date, checkin_window: "lunch", meal_text: lunch.t, energy: clamp(energy - (lunch.c > 80 ? 1 : 0), 1, 5), created_at: ts(date, 13, 30), updated_at: ts(date, 13, 30) });
  }
  if (!isToday && chance(0.35)) {
    checkins.push({ user_id: UID, date, checkin_window: "general", stress, notes: rough ? "Deadline crunch, back-to-back meetings" : (chance(0.3) ? pick(["Scalp itchy this afternoon", "Afternoon slump around 3pm", "Felt focused all afternoon"]) : null), created_at: ts(date, 16, 10), updated_at: ts(date, 16, 10) });
  }
  if (!isToday && chance(0.5)) {
    checkins.push({ user_id: UID, date, checkin_window: "dinner", meal_text: dinner.t, notes: chance(0.3) ? "Bone broth before dinner" : null, created_at: ts(date, 19, 45), updated_at: ts(date, 19, 45) });
  }
  if (!isToday && chance(0.7)) {
    checkins.push({
      user_id: UID, date, checkin_window: "bedtime",
      mood: clamp(mood + (chance(0.3) ? 1 : 0), 1, 5), stress,
      notes: rough ? "Hotel room too warm. Late dinner." : (i >= STORY.protocolStart && chance(0.4) ? pick(["Screens off at 10, did 4-7-8 breathing", "Room at 65, mask on — easy wind down", "Last meal at 7pm, felt light going to bed"]) : (chance(0.2) ? pick(["Good day overall", "Too much screen time tonight", "Had a glass of wine with dinner"]) : null)),
      created_at: ts(date, 22, 10), updated_at: ts(date, 22, 10),
    });
  }

  // Symptom log (1-10 scales; seb_derm 0 clear → 10 flare)
  if (chance(isToday ? 1 : 0.78)) {
    const sebTrend = 4.5 - 2.5 * (i / TODAY_IDX);
    symptoms.push({
      user_id: UID, date,
      feel_score: clamp(Math.round(6 + (o.readiness - 72) / 7 + (rough ? -1.5 : 0) + gauss(0.7)), 1, 10),
      sleep_quality: clamp(Math.round(o.sleep_score / 10 + gauss(0.6)), 1, 10),
      seb_derm_score: clamp(Math.round(sebTrend + (rough ? 2.5 : 0) + gauss(0.7)), 0, 10),
      stress: clamp(Math.round(stress * 2 + gauss(0.7)), 1, 10),
      energy_pm: isToday ? null : clamp(Math.round(6.2 + (o.readiness - 72) / 9 + (rough ? -1.5 : 0) + gauss(0.8)), 1, 10),
      notes: rough && chance(0.5) ? "Travel week — scalp flaring, sleep off" : null,
      logged_at: ts(date, isToday ? 8 : 21, 30),
    });
  }

  // Intake log — most days
  if (isToday || chance(rough ? 0.55 : 0.87)) {
    const push = (hh, mm, kind, m, extra = {}) =>
      intake.push({
        user_id: UID, date, logged_at: ts(date, hh, mm), kind, content: m.t ?? m,
        calories: m.cal ?? null, protein_g: m.p ?? null, fat_g: m.f ?? null, carbs_g: m.c ?? null,
        water_oz: null, analyzed_by: pick(["claude_text", "claude_voice", "claude_vision"]),
        photo_url: null, serving: null, notes: null, created_at: ts(date, hh, mm), ...extra,
      });
    push(7, 10, "beverage", { t: "Lifeboost coffee, black", cal: 5, p: 0, f: 0, c: 1 }, { water_oz: 12, analyzed_by: "manual" });
    push(8, intBetween(0, 40), "meal", bfast);
    if (!isToday) {
      push(12, intBetween(30, 59), "meal", lunch);
      if (chance(0.65)) push(15, intBetween(30, 59), "snack", pick(SNACKS));
      push(19, intBetween(0, 40), "meal", dinner);
    }
    const waters = isToday ? 2 : intBetween(rough ? 2 : 3, 6);
    for (let w = 0; w < waters; w++) {
      intake.push({
        user_id: UID, date, logged_at: ts(date, 7 + w * 2 + (w > 0 ? 1 : 0), 15), kind: "water", content: "16oz water",
        calories: 0, protein_g: 0, fat_g: 0, carbs_g: 0, water_oz: 16, analyzed_by: "quick_water",
        photo_url: null, serving: "16 oz", notes: null, created_at: ts(date, 7 + w * 2 + (w > 0 ? 1 : 0), 15),
      });
    }
  }
}
await insertChunked("daily_checkins", checkins.map((c) => ({ meal_text: null, workout_text: null, mood: null, energy: null, stress: null, notes: null, data: {}, ...c })));
await insertChunked("symptom_log", symptoms);
await insertChunked("intake_log", intake);

// ---------------------------------------------------------------- biomarkers
const MARKERS = [
  // name, display, unit, ref, panel, v1, v2, lo, hi
  ["vitamin_d_25oh", "Vitamin D, 25-Hydroxy", "ng/mL", "30-100", "vitamins", 24, 52, 30, 100],
  ["ferritin", "Ferritin", "ng/mL", "38-380", "iron", 48, 71, 38, 380],
  ["hs_crp", "hs-CRP", "mg/L", "<1.0", "inflammation", 2.6, 1.1, null, 1.0],
  ["hba1c", "Hemoglobin A1c", "%", "<5.7", "metabolic", 5.7, 5.4, null, 5.6],
  ["glucose_fasting", "Glucose, Fasting", "mg/dL", "65-99", "CMP", 101, 89, 65, 99],
  ["insulin_fasting", "Insulin, Fasting", "uIU/mL", "<18.4", "metabolic", 9.8, 6.1, null, 18.4],
  ["total_cholesterol", "Cholesterol, Total", "mg/dL", "<200", "lipid panel", 212, 194, null, 199],
  ["ldl_c", "LDL Cholesterol", "mg/dL", "<100", "lipid panel", 138, 121, null, 99],
  ["hdl_c", "HDL Cholesterol", "mg/dL", ">39", "lipid panel", 46, 53, 40, null],
  ["triglycerides", "Triglycerides", "mg/dL", "<150", "lipid panel", 132, 88, null, 149],
  ["apob", "Apolipoprotein B", "mg/dL", "<90", "lipid panel", 104, 92, null, 89],
  ["testosterone_total", "Testosterone, Total", "ng/dL", "264-916", "hormones", 512, 604, 264, 916],
  ["testosterone_free", "Testosterone, Free", "ng/dL", "8.7-25.1", "hormones", 9.1, 11.2, 8.7, 25.1],
  ["shbg", "SHBG", "nmol/L", "16.5-55.9", "hormones", 38, 35, 16.5, 55.9],
  ["cortisol_am", "Cortisol, AM", "ug/dL", "6.2-19.4", "hormones", 19.8, 15.2, 6.2, 19.4],
  ["tsh", "TSH", "uIU/mL", "0.45-4.5", "thyroid", 2.1, 1.9, 0.45, 4.5],
  ["magnesium_rbc", "Magnesium, RBC", "mg/dL", "4.2-6.8", "minerals", 4.0, 5.3, 4.2, 6.8],
  ["vitamin_b12", "Vitamin B12", "pg/mL", "232-1245", "vitamins", 610, 640, 232, 1245],
  ["homocysteine", "Homocysteine", "umol/L", "<10.4", "inflammation", 11.8, 9.2, null, 10.4],
  ["alt", "ALT", "U/L", "0-44", "CMP", 31, 26, 0, 44],
];
const bioRows = [];
for (const [idx, panelDay] of [[5, STORY.panel1], [6, STORY.panel2]]) {
  const drawn_on = dateOf(panelDay);
  for (const m of MARKERS) {
    const [name, display_name, unit, reference_range, panel, v1, v2, lo, hi] = m;
    const value = idx === 5 ? v1 : v2;
    const flag = lo != null && value < lo ? "L" : hi != null && value > hi ? "H" : "N";
    bioRows.push({
      user_id: UID, name, display_name, value, unit, reference_range, flag, drawn_on,
      source: "function", panel,
      notes: idx === 6 && name === "vitamin_d_25oh" ? "Up from 24 after 8 weeks of 5000 IU + K2" : null,
      created_at: ts(addDays(drawn_on, 3), 18, 0), updated_at: ts(addDays(drawn_on, 3), 18, 0),
    });
  }
}
await insertChunked("biomarkers", bioRows);

// ---------------------------------------------------------------- reactions
const reactionRows = [];
const REACTION_PLAN = {
  "umzu-daily-mag": [["no_change", "Too early to tell"], ["helped", "Falling asleep faster"], ["helped", "HRV trending up on Oura"], ["helped", null], ["helped", "No more 3am wakeups this week"], ["helped", null], ["helped", null]],
  "l-theanine": [["helped", "Calmer wind-down"], ["no_change", null], ["no_change", null], ["helped", null], ["no_change", "Not sure it's doing much"], ["no_change", null]],
  "collagen": [["no_change", null], ["no_change", null], ["helped", "Joints feel better after legs"], ["no_change", null], ["forgot", null], ["no_change", null]],
  "creatine": [["helped", "Extra rep on bench"], ["helped", null], ["no_change", null], ["helped", null]],
  "kimchi": [["worse", "A bit bloated"], ["no_change", null], ["helped", "Digestion settled"], ["helped", null], ["helped", null]],
  "mouth-tape": [["helped", "Less dry mouth"], ["helped", null], ["no_change", null]],
  "glycine": [["helped", null], ["no_change", null], ["helped", "Deeper sleep feel"]],
  "hp-saw-palmetto": [["no_change", null], ["no_change", null]],
};
for (const [sid, plan] of Object.entries(REACTION_PLAN)) {
  const it = bySid[sid];
  if (!it) continue;
  const startIdx = Math.max(0, idxOf(it.started_on));
  // First reaction a week in — sooner for late starts so they still get
  // a few distinct reaction days before today.
  const lag = Math.min(7, Math.max(2, Math.floor((TODAY_IDX - startIdx) / 3)));
  const firstIdx = Math.max(startIdx + lag, sid === "glycine" || sid === "hp-saw-palmetto" ? TODAY_IDX - 28 : 0);
  const span = TODAY_IDX - firstIdx;
  plan.forEach(([reaction, notes], k) => {
    const i = Math.min(TODAY_IDX - 1, firstIdx + Math.round((span * k) / Math.max(1, plan.length - 1)));
    const date = dateOf(i);
    if (reactionRows.some((r) => r.item_id === it.id && r.reacted_on === date)) return;
    reactionRows.push({ user_id: UID, item_id: it.id, reaction, reacted_on: date, notes, created_at: ts(date, 21, 30) });
  });
}
await insertChunked("item_reactions", reactionRows);

// ---------------------------------------------------------------- protocol enrollment
await insertChunked("protocol_enrollments", [{
  user_id: UID, protocol_slug: PROTO.slug, enrolled_at: ts(PROTO_START, 20, 55), start_date: PROTO_START, status: "active",
}]);

// ---------------------------------------------------------------- changelog
const changelog = [];
const addCl = (i, change_type, sid, reasoning, triggered_by = "coach") => {
  const it = bySid[sid];
  changelog.push({
    user_id: UID, date: dateOf(i), change_type, item_id: it?.id ?? null, item_name: it?.name ?? sid,
    reasoning, triggered_by, approved_by_user: true, created_at: ts(dateOf(i), 20, 0),
  });
};
addCl(MID_WINDOW_START["collagen"], "add", "collagen", "Adding collagen peptides for graft-site healing and joint support during the lifting block.", "user");
addCl(MID_WINDOW_START["l-theanine"], "add", "l-theanine", "Racing thoughts at bedtime 4 of the last 7 nights. L-theanine 200mg is a low-risk first lever before anything sedating.");
addCl(STORY.magStart, "add", "umzu-daily-mag", "RBC magnesium came back 4.0 (below range) and HRV has been flat at ~38ms. Magnesium with dinner should move both.");
addCl(MID_WINDOW_START["kimchi"], "add", "kimchi", "Gut protocol: add one fermented food daily for microbial diversity alongside DS-01.", "user");
addCl(MID_WINDOW_START["l-theanine"] + 14, "adjust", "l-theanine", "Moved l-theanine from 100mg to 200mg — no clear effect at the lower dose after 2 weeks.");
addCl(MID_WINDOW_START["creatine"], "add", "creatine", "Lifting 3x/week now. Creatine 5g is the best-evidenced performance add and has cognitive upside.");
addCl(50, "demote", "bb-tongkat", "Parking tongkat ali on the backburner — testosterone is mid-range and labs are what to move first.", "user");
addCl(MID_WINDOW_START["mouth-tape"], "add", "mouth-tape", "Dry mouth on waking + Oura shows elevated breathing disturbance. Trialing mouth tape.");
changelog.push({
  user_id: UID, date: PROTO_START, change_type: "add", item_id: null, item_name: PROTO.name,
  reasoning: "Enrolled in Sleep Restoration 21 to lock in the HRV gains — earlier dinners, cooler room, screens off, consistent bedtime.",
  triggered_by: "user", approved_by_user: true, created_at: ts(PROTO_START, 20, 56),
});
addCl(TODAY_IDX - 3, "adjust", "pumpkin-seed-oil", "Ran out — flagged for reorder automatically from skip reason.", "system");
await insertChunked("changelog", changelog);

// ---------------------------------------------------------------- voice memos
const memos = [
  [36, "vent", 48, "Travel week is killing me. Hotel room is like 74 degrees, I skipped all the night stuff two days in a row and my scalp is itchy again. Just want to get home."],
  [38, "log", 22, "Note to self — forgot the pill case in Chicago, missing the AM stack until Friday."],
  [52, "note", 31, "Magnesium seems to be working. Haven't woken up at 3am in like a week and Oura HRV keeps going up."],
  [TODAY_IDX - 9, "note", 27, "Second bloodwork panel done. Fasting, no biotin for three days. Curious about vitamin D and ApoB."],
  [TODAY_IDX - 4, "swap", 19, "Thinking about swapping pumpkin seed oil for something cheaper, it's running out anyway."],
  [TODAY_IDX - 1, "vent", 35, "Day eleven of the sleep protocol. The no screens thing is the hardest part but I'm falling asleep way faster."],
];
await insertChunked("voice_memos", memos.map(([i, context_tag, duration_seconds, transcript]) => ({
  user_id: UID, transcript, context_tag, duration_seconds,
  item_id: context_tag === "swap" ? idOf("pumpkin-seed-oil") : null,
  extracted: context_tag === "swap" ? { action: "flag_review", item: "Pumpkin Seed Oil" } : null,
  created_at: ts(dateOf(i), 21, 5),
})));

// ---------------------------------------------------------------- achievements
const ach = [
  ["first_checkoff", 0, 1], ["first_meal_logged", 0, 1], ["first_skip_with_reason", 1, 1],
  ["streak_3", 2, 3], ["perfect_day", 4, 1], ["streak_7", 6, 7], ["hundred_items_logged", 3, 100],
  ["first_reaction", 17, 1], ["first_voice_memo", 36, 1], ["ten_reactions", 55, 10],
  ["first_protocol", STORY.protocolStart, 1], ["first_refinement", 20, 1],
  ["first_photo_meal", TODAY_IDX - 5, 1], ["streak_30", TODAY_IDX - 2, 30],
];
await insertChunked("achievements", ach.map(([achievement_key, i, metric_value]) => ({
  user_id: UID, achievement_key, metric_value, unlocked_at: ts(dateOf(i), 21, 0),
})));

// ---------------------------------------------------------------- wishlist
await insertChunked("wishlist_items", [
  { user_id: UID, name: "Theragun Mini", url: "https://www.therabody.com/", est_cost: 199, category: "gear", priority: "medium", notes: "Post-leg-day recovery. Wait for a sale.", created_at: ts(dateOf(48), 20, 0) },
  { user_id: UID, name: "HigherDOSE sauna blanket", url: "https://higherdose.com/", est_cost: 499, category: "gear", priority: "low", notes: "Cheaper than a gym with a sauna. Check heat tolerance post-op first.", created_at: ts(dateOf(57), 20, 0) },
  { user_id: UID, name: "Thorne Basic Nutrients 2/Day", url: "https://www.thorne.com/", est_cost: 42, category: "supplement", priority: "high", notes: "Could replace 3 separate bottles — compare doses with Coach.", created_at: ts(dateOf(TODAY_IDX - 6), 20, 0) },
]);

// ---------------------------------------------------------------- insights
await insertChunked("insights", [
  { user_id: UID, created_at: ts(TODAY, 6, 50), type: "daily_suggestion", title: "HRV up 22% since magnesium", body: "Your 14-day HRV average is 47ms vs 38ms in the 30 days before you started magnesium. Keep dinner-time dosing; consider moving glycine 30 min earlier.", confidence: "medium", status: "new" },
  { user_id: UID, created_at: ts(addDays(TODAY, -1), 7, 0), type: "reorder_alert", title: "Pumpkin Seed Oil is out", body: "You logged 'ran out' 3 days ago. Reorder or decide whether to drop it — it's $10/mo for a modest DHT effect.", confidence: "high", status: "new" },
  { user_id: UID, created_at: ts(dateOf(STORY.panel2 + 3), 9, 0), type: "day_milestone", title: "Second panel: 6 markers back in range", body: "Vitamin D 24 → 52, fasting glucose 101 → 89, RBC magnesium 4.0 → 5.3. ApoB and LDL still above target.", confidence: "high", status: "dismissed" },
]);

// ---------------------------------------------------------------- recipes
await insertChunked("recipes", [
  { user_id: UID, name: "Bulgogi rice bowl", description: "Weeknight Korean beef bowl with kimchi.", source: "claude", servings: 2, calories_per_serving: 780, protein_g: 48, fat_g: 28, carbs_g: 80,
    ingredients: [{ name: "Grass-fed ground beef", amount: "1 lb" }, { name: "Jasmine rice", amount: "1 cup dry" }, { name: "Kimchi", amount: "1 cup" }, { name: "Soy sauce, garlic, ginger, sesame oil", amount: "to taste" }],
    instructions: "Brown beef with garlic + ginger, add soy and a little honey. Serve over rice with kimchi and cucumber.", tags: ["dinner", "high-protein"], goals: ["gut", "recovery"], is_favorite: true, times_made: 6, last_made: dateOf(TODAY_IDX - 4), created_at: ts(dateOf(41), 18, 0) },
  { user_id: UID, name: "Salmon + broccoli sheet pan", description: "One-pan omega-3 dinner.", source: "claude", servings: 2, calories_per_serving: 690, protein_g: 46, fat_g: 32, carbs_g: 44,
    ingredients: [{ name: "Wild salmon fillets", amount: "2 x 6oz" }, { name: "Broccoli", amount: "1 head" }, { name: "Quinoa", amount: "1 cup cooked" }, { name: "EVOO + lemon", amount: "2 tbsp" }],
    instructions: "425°F for 14 minutes. Finish with lemon and flaky salt.", tags: ["dinner", "omega-3"], goals: ["inflammation", "hair"], is_favorite: false, times_made: 3, last_made: dateOf(TODAY_IDX - 9), created_at: ts(dateOf(22), 18, 0) },
  { user_id: UID, name: "Protein overnight oats", description: "Grab-and-go breakfast for travel weeks.", source: "user", servings: 1, calories_per_serving: 560, protein_g: 42, fat_g: 16, carbs_g: 62,
    ingredients: [{ name: "Rolled oats", amount: "1/2 cup" }, { name: "Whey", amount: "1 scoop" }, { name: "Greek yogurt", amount: "1/2 cup" }, { name: "Blueberries", amount: "1/2 cup" }],
    instructions: "Mix, refrigerate overnight.", tags: ["breakfast", "travel"], goals: ["metabolic"], is_favorite: true, times_made: 9, last_made: dateOf(TODAY_IDX - 2), created_at: ts(dateOf(30), 18, 0) },
]);

// ---------------------------------------------------------------- coach conversations
await insertChunked("claude_conversations", [
  [MID_WINDOW_START["l-theanine"], "I keep waking at 3am with racing thoughts. What should I try first?", "Start with **L-theanine 200mg** 30 min before bed — low risk, no grogginess. Your Oura shows the wakeups cluster on high-stress days, so pair it with screens off by 10pm. Re-check in 2 weeks."],
  [STORY.panel1 + 4, "Can you read my bloodwork and tell me the top 2 things?", "Two things stand out:\n\n1. **Vitamin D 24 ng/mL** (low). Your 5000 IU is right; take it with your fattiest meal and recheck in 8 weeks.\n2. **RBC magnesium 4.0** (below range) — plausible link to your flat HRV. I'd add magnesium with dinner.\n\nApoB 104 is worth watching but diet first."],
  [52, "Is the magnesium actually doing anything or am I imagining it?", "It's showing up in the data: 14-day HRV average is **44ms vs 38ms** in the month before you started, and RHR is down ~2 bpm. Sleep latency improved too. Keep it."],
  [TODAY_IDX - 2, "How am I doing on the sleep protocol?", "Day 10 of 21 and it's working: sleep score averaging **84** vs 78 before enrollment, bedtime variance down to ±20 min. Biggest remaining lever: last meal 3h before bed — you hit that only 4 of 10 nights."],
].map(([i, u, a]) => ({ user_id: UID, created_at: ts(dateOf(i), 21, 40), messages_json: { user: u, assistant: a } })));

// ---------------------------------------------------------------- reviews
await insertChunked("reviews", [
  { user_id: UID, scheduled_date: dateOf(STORY.panel2 + 2), phase_name: "Bloodwork follow-up (8 weeks)", status: "completed", decisions_json: { keep: ["Vitamin D3", "UMZU Daily Magnesium"], watch: ["ApoB", "LDL"] }, claude_analysis: "Six markers improved into range. Lipids next.", completed_at: ts(dateOf(STORY.panel2 + 3), 9, 30) },
  { user_id: UID, scheduled_date: addDays(PROTO_START, 21), phase_name: "Sleep Restoration 21 — wrap-up", status: "upcoming" },
  { user_id: UID, scheduled_date: addDays("2026-10-23", SHIFT), phase_name: "6-month gut protocol review", status: "upcoming" },
]);

// ---------------------------------------------------------------- summary
console.log("\nDone. Row counts for demo user:");
console.table(await countRows(UID));

// /api/capture — universal AI capture endpoint. Takes voice / photo /
// text, classifies the intent, routes to the right system, returns
// what was done so the client can confirm with a toast.
//
// This is the magic moment for the user: tap +, say or show anything,
// and the app figures out where to file it. No more "which tab am I
// on" or "is this a meal log or a stack add."
//
// Intents we route to today:
//   - check_off       → mark a stack item taken (today's stack_log)
//   - skip_with_reason → mark a stack item skipped today
//   - log_meal        → POST /api/intake (analyze=true) for macro inference
//   - log_workout     → POST /api/intake with kind='meal' or voice memo log
//   - add_item        → fire Coach with an add proposal pre-filled
//   - retire_item     → fire Coach with a retire proposal pre-filled
//   - log_symptom     → upsert daily_checkins (notes + scale fields)
//   - voice_memo      → POST /api/voice-memo as a free-form note
//   - chat            → fallback: open Coach with the text seeded
//
// Photo flow piggybacks on the existing /api/analyze for food photos
// + supplement label scans.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropic, MODELS } from "@/lib/anthropic";
import { todayISO } from "@/lib/constants";

export const runtime = "nodejs";
export const maxDuration = 30;

type CaptureKind = "voice" | "photo" | "text";

type Body = {
  kind: CaptureKind;
  /** Free-text payload. For voice this is the transcript. For photo
   *  this is an optional caption. For text this is what the user typed. */
  text?: string;
  /** Base64-encoded image (data URL or raw base64). For photo only. */
  image_base64?: string;
  image_mime?: string;
  /** Optional hint from the calling tab — "meal", "workout", "memo".
   *  Biases the classifier when ambiguous. */
  hint?: string;
};

type CaptureIntent =
  | "check_off"
  | "skip_with_reason"
  | "log_meal"
  | "log_workout"
  | "add_item"
  | "retire_item"
  | "log_symptom"
  | "voice_memo"
  | "chat";

type ClassifyResult = {
  intent: CaptureIntent;
  /** Subject: e.g. "magnesium glycinate" for check_off, the meal text
   *  for log_meal, the workout description for log_workout. */
  subject?: string;
  /** For skip_with_reason. */
  reason?: string;
  /** For log_symptom — fields like {sleep_quality: 6, mood: 4}. */
  fields?: Record<string, number | string>;
  /** Plain-English confirmation we'll show in the toast. */
  confirmation: string;
};

const CLASSIFY_SYSTEM = `You are an intent classifier for a personal health app. The user just said, typed, or showed something. Pick the SINGLE best intent + structured payload.

Reply with JUST this JSON, no prose:
{
  "intent": "check_off" | "skip_with_reason" | "log_meal" | "log_workout" | "add_item" | "retire_item" | "log_symptom" | "voice_memo" | "chat",
  "subject": "<short string — item name, meal description, etc.>",
  "reason": "<for skip_with_reason: the reason>",
  "fields": { "<symptom_field>": <num>, ... },
  "confirmation": "<one short sentence we'll toast back to the user>"
}

Rules:
- "I just took my magnesium" / "took the omega 3" → check_off, subject = item name
- "skipping breakfast, fasting" / "didn't take my creatine" → skip_with_reason
- "had 4 eggs and avocado" / "lunch was salmon and rice" → log_meal, subject = full meal description
- "squatted 225 5x5" / "did zone 2 30 min" → log_workout, subject = workout description
- "add fish oil to my stack" / "I want to start tongkat ali" → add_item, subject = item name
- "drop magnesium" / "stopping creatine for now" → retire_item, subject = item name
- "sleep was 6", "mood 3", "energy low" → log_symptom, fields = {sleep_quality: 6, mood: 3, energy: 2}
- Voice memos that are just observations / reflections → voice_memo
- Anything ambiguous, complex, or a question → chat (we'll open Coach)

confirmation should be like "Logged: 4 eggs and avocado" or "Magnesium ✓" or "Asking Coach…"`;

async function classify(
  text: string,
  hint?: string,
): Promise<ClassifyResult> {
  const anthropic = getAnthropic();
  const userMsg = hint
    ? `User context hint: they were on the "${hint}" tab.\n\nWhat the user said/wrote: ${text}`
    : `What the user said/wrote: ${text}`;
  const res = await anthropic.messages.create({
    model: MODELS.chat,
    max_tokens: 256,
    system: CLASSIFY_SYSTEM,
    messages: [{ role: "user", content: userMsg }],
  });
  const block = res.content[0];
  if (!block || block.type !== "text") {
    return {
      intent: "chat",
      subject: text,
      confirmation: "Opening Coach…",
    };
  }
  // Trim possible code-fence wrapping
  const raw = block.text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  try {
    return JSON.parse(raw) as ClassifyResult;
  } catch {
    return {
      intent: "chat",
      subject: text,
      confirmation: "Opening Coach…",
    };
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

  // Photo path: punt to the existing /api/analyze for now. Coach's
  // vision pipeline already handles food + label OCR. We re-classify
  // the analysis result text into our intent space.
  // (Future: handle photo classification here directly.)

  const text = body.text?.trim() ?? "";
  if (!text && body.kind !== "photo") {
    return NextResponse.json({ error: "Empty capture" }, { status: 400 });
  }

  const intent = await classify(text, body.hint);

  // Execute the intent with side effects scoped to this user.
  let executedAction: string | null = null;
  let actionData: Record<string, unknown> = {};

  if (intent.intent === "check_off" && intent.subject) {
    // Find the user's item by name (case-insensitive substring match)
    // and mark today's stack_log as taken.
    const { data: itemRow } = await supabase
      .from("items")
      .select("id, name")
      .eq("user_id", user.id)
      .ilike("name", `%${intent.subject}%`)
      .in("status", ["active", "queued"])
      .limit(1)
      .maybeSingle();
    if (itemRow) {
      const today = todayISO();
      await supabase.from("stack_log").upsert(
        {
          user_id: user.id,
          item_id: itemRow.id,
          date: today,
          taken: true,
          logged_at: new Date().toISOString(),
        },
        { onConflict: "user_id,item_id,date" },
      );
      executedAction = "check_off";
      actionData = { item_id: itemRow.id, item_name: itemRow.name };
    } else {
      // Couldn't find item — fallback to chat with Coach
      executedAction = "chat";
      actionData = { seed_text: text };
    }
  } else if (intent.intent === "skip_with_reason" && intent.subject) {
    const { data: itemRow } = await supabase
      .from("items")
      .select("id, name")
      .eq("user_id", user.id)
      .ilike("name", `%${intent.subject}%`)
      .in("status", ["active", "queued"])
      .limit(1)
      .maybeSingle();
    if (itemRow) {
      const today = todayISO();
      await supabase.from("stack_log").upsert(
        {
          user_id: user.id,
          item_id: itemRow.id,
          date: today,
          taken: false,
          skipped_reason: intent.reason ?? text,
          logged_at: new Date().toISOString(),
        },
        { onConflict: "user_id,item_id,date" },
      );
      executedAction = "skip_with_reason";
      actionData = { item_id: itemRow.id, item_name: itemRow.name };
    } else {
      executedAction = "chat";
      actionData = { seed_text: text };
    }
  } else if (intent.intent === "log_meal" && intent.subject) {
    // Hand off to /api/intake with analyze=true so Claude infers macros.
    // Inline the call rather than fetching ourselves to keep auth.
    const anthropic = getAnthropic();
    const macroSystem = `Estimate macros for the meal description. Reply JSON only: {"calories": int, "protein_g": num, "fat_g": num, "carbs_g": num, "serving": "..."}`;
    let macros: {
      calories: number;
      protein_g: number;
      fat_g: number;
      carbs_g: number;
      serving: string;
    } | null = null;
    try {
      const r = await anthropic.messages.create({
        model: MODELS.chat,
        max_tokens: 200,
        system: macroSystem,
        messages: [{ role: "user", content: intent.subject }],
      });
      const b = r.content[0];
      if (b?.type === "text") {
        const raw = b.text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
        macros = JSON.parse(raw);
      }
    } catch {
      // Macros failed — log without them
    }
    await supabase.from("intake_log").insert({
      user_id: user.id,
      date: todayISO(),
      logged_at: new Date().toISOString(),
      kind: "meal",
      content: intent.subject,
      calories: macros?.calories ?? null,
      protein_g: macros?.protein_g ?? null,
      fat_g: macros?.fat_g ?? null,
      carbs_g: macros?.carbs_g ?? null,
      serving: macros?.serving ?? null,
    });
    executedAction = "log_meal";
    actionData = { meal: intent.subject, macros };
  } else if (intent.intent === "log_workout" && intent.subject) {
    // Workouts go to voice_memos (free-form context) — we don't yet
    // have a structured workouts table.
    await supabase.from("voice_memos").insert({
      user_id: user.id,
      transcript: intent.subject,
      context_tag: "workout",
    });
    executedAction = "log_workout";
    actionData = { workout: intent.subject };
  } else if (intent.intent === "log_symptom") {
    // Upsert today's daily_checkin with the inferred fields.
    if (intent.fields && Object.keys(intent.fields).length > 0) {
      const today = todayISO();
      await supabase.from("daily_checkins").upsert(
        {
          user_id: user.id,
          date: today,
          checkin_window: "general",
          ...intent.fields,
          notes: text,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,date,checkin_window" },
      );
      executedAction = "log_symptom";
      actionData = { fields: intent.fields };
    } else {
      // No structured fields — fall back to voice memo
      await supabase.from("voice_memos").insert({
        user_id: user.id,
        transcript: text,
        context_tag: "symptom",
      });
      executedAction = "voice_memo";
    }
  } else if (intent.intent === "voice_memo") {
    await supabase.from("voice_memos").insert({
      user_id: user.id,
      transcript: text,
      context_tag: body.hint ?? null,
    });
    executedAction = "voice_memo";
  } else if (
    intent.intent === "add_item" ||
    intent.intent === "retire_item" ||
    intent.intent === "chat"
  ) {
    // These intents need user judgment — punt to Coach with a seed
    // prompt. The client opens the Coach overlay with this text
    // pre-filled.
    executedAction = "chat";
    if (intent.intent === "add_item" && intent.subject) {
      actionData = {
        seed_text:
          `Add "${intent.subject}" to my stack. Decide if it fits — check hard NOs, stack overlap, goals. ` +
          `If it fits, emit a one-tap proposal in <<<PROPOSAL ... PROPOSAL>>> format.`,
        send: true,
      };
    } else if (intent.intent === "retire_item" && intent.subject) {
      actionData = {
        seed_text:
          `Retire "${intent.subject}" from my stack. Confirm by emitting a one-tap proposal in <<<PROPOSAL ... PROPOSAL>>> format with action: retire.`,
        send: true,
      };
    } else {
      actionData = { seed_text: text, send: false };
    }
  }

  return NextResponse.json({
    ok: true,
    action: executedAction,
    confirmation: intent.confirmation,
    data: actionData,
  });
}

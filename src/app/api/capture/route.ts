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
import {
  getAnthropic,
  jsonSchemaFormat,
  llmErrorResponse,
  LLMJsonError,
  LLMStopError,
  MODELS,
  MODEL_OPTS,
  parseJsonResponse,
} from "@/lib/anthropic";
import { internalError, jsonError, readJson } from "@/lib/api";
import { rateLimitOrError, recordUsage } from "@/lib/rate-limit";
import { getUserToday } from "@/lib/user-date";

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
  userId: string,
  hint?: string,
): Promise<ClassifyResult> {
  const anthropic = getAnthropic();
  const userMsg = hint
    ? `User context hint: they were on the "${hint}" tab.\n\nWhat the user said/wrote: ${text}`
    : `What the user said/wrote: ${text}`;
  const res = await anthropic.messages.create({
    ...MODEL_OPTS.chat,
    max_tokens: 1024,
    system: CLASSIFY_SYSTEM,
    messages: [{ role: "user", content: userMsg }],
  });
  void recordUsage(userId, "coach", {
    route: "/api/capture",
    model: MODELS.chat,
    tokens_in: res.usage?.input_tokens,
    tokens_out: res.usage?.output_tokens,
  });
  try {
    const parsed = parseJsonResponse<ClassifyResult>(res);
    if (!parsed || typeof parsed.intent !== "string") throw new LLMJsonError("no intent", "");
    return parsed;
  } catch (err) {
    // Truncated / refused / malformed → let Coach handle it as chat.
    if (err instanceof LLMStopError || err instanceof LLMJsonError) {
      return { intent: "chat", subject: text, confirmation: "Opening Coach…" };
    }
    throw err;
  }
}

const MACRO_SCHEMA = {
  type: "object",
  properties: {
    calories: { type: "integer" },
    protein_g: { type: "number" },
    fat_g: { type: "number" },
    carbs_g: { type: "number" },
    serving: { type: "string" },
  },
  required: ["calories", "protein_g", "fat_g", "carbs_g", "serving"],
  additionalProperties: false,
};

/** daily_checkins scale columns (1-5) the classifier may target. Common
 *  synonyms map onto them; everything else is kept as jsonb extras. */
const CHECKIN_COLUMN_ALIASES: Record<string, "mood" | "energy" | "stress"> = {
  mood: "mood",
  feel: "mood",
  feel_score: "mood",
  energy: "energy",
  energy_pm: "energy",
  stress: "stress",
};

function splitSymptomFields(fields: ClassifyResult["fields"]): {
  columns: Partial<Record<"mood" | "energy" | "stress", number>>;
  extras: Record<string, number | string>;
} {
  const columns: Partial<Record<"mood" | "energy" | "stress", number>> = {};
  const extras: Record<string, number | string> = {};
  for (const [rawKey, rawVal] of Object.entries(fields ?? {})) {
    const key = rawKey.trim().toLowerCase();
    if (!/^[a-z0-9_]{1,40}$/.test(key)) continue;
    const col = CHECKIN_COLUMN_ALIASES[key];
    const num = typeof rawVal === "number" ? rawVal : Number(rawVal);
    if (col && Number.isFinite(num)) {
      // Columns are 1-5 ints; clamp + round whatever the model returned.
      columns[col] = Math.min(5, Math.max(1, Math.round(num)));
    } else if (typeof rawVal === "number" || typeof rawVal === "string") {
      extras[key] = typeof rawVal === "string" ? rawVal.slice(0, 200) : rawVal;
    }
  }
  return { columns, extras };
}

export async function POST(request: NextRequest) {
  try {
    return await handle(request);
  } catch (err) {
    return llmErrorResponse(err) ?? internalError("/api/capture", err);
  }
}

async function handle(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("unauthorized", "Not signed in", 401);
  const parsedBody = await readJson<Body>(request);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;

  // Photo path: punt to the existing /api/analyze for now. Coach's
  // vision pipeline already handles food + label OCR. We re-classify
  // the analysis result text into our intent space.
  // (Future: handle photo classification here directly.)

  const text = body.text?.trim() ?? "";
  if (!text && body.kind !== "photo") {
    return jsonError("bad_request", "Empty capture", 400);
  }

  const limited = await rateLimitOrError(user.id, "coach");
  if (limited) return limited;

  const intent = await classify(text, user.id, body.hint);
  // Server clock is UTC; day keys are the user's local calendar day.
  const { today } = await getUserToday(supabase, user.id);

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
      const { error: logErr } = await supabase.from("stack_log").upsert(
        {
          user_id: user.id,
          item_id: itemRow.id,
          date: today,
          taken: true,
          logged_at: new Date().toISOString(),
        },
        { onConflict: "user_id,item_id,date" },
      );
      if (logErr) console.error("capture: stack_log check_off", logErr);
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
      const { error: logErr } = await supabase.from("stack_log").upsert(
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
      if (logErr) console.error("capture: stack_log skip", logErr);
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
    const macroSystem = `Estimate macros for the meal description: calories (int), protein_g, fat_g, carbs_g, and a short serving description.`;
    type Macros = {
      calories: number;
      protein_g: number;
      fat_g: number;
      carbs_g: number;
      serving: string;
    };
    let macros: Macros | null = null;
    try {
      const r = await anthropic.messages.create({
        ...MODEL_OPTS.chat,
        max_tokens: 1024,
        // Structured outputs: the response is guaranteed to match the
        // schema, so no fence-stripping / partial-JSON guessing.
        output_config: jsonSchemaFormat(MACRO_SCHEMA),
        system: macroSystem,
        messages: [{ role: "user", content: intent.subject }],
      });
      void recordUsage(user.id, "coach", {
        route: "/api/capture",
        model: MODELS.chat,
        tokens_in: r.usage?.input_tokens,
        tokens_out: r.usage?.output_tokens,
      });
      macros = parseJsonResponse<Macros>(r);
    } catch (err) {
      // Macros failed — log the meal without them.
      console.warn("capture: macro estimate failed", err);
    }
    const { error: intakeErr } = await supabase.from("intake_log").insert({
      user_id: user.id,
      date: today,
      logged_at: new Date().toISOString(),
      kind: "meal",
      content: intent.subject,
      calories: macros?.calories ?? null,
      protein_g: macros?.protein_g ?? null,
      fat_g: macros?.fat_g ?? null,
      carbs_g: macros?.carbs_g ?? null,
      serving: macros?.serving ?? null,
    });
    if (intakeErr) console.error("capture: intake_log insert", intakeErr);
    executedAction = "log_meal";
    actionData = { meal: intent.subject, macros };
  } else if (intent.intent === "log_workout" && intent.subject) {
    // Workouts go to voice_memos (free-form context) — we don't yet
    // have a structured workouts table.
    const { error: memoErr } = await supabase.from("voice_memos").insert({
      user_id: user.id,
      transcript: intent.subject,
      context_tag: "workout",
    });
    if (memoErr) console.error("capture: voice_memos workout", memoErr);
    executedAction = "log_workout";
    actionData = { workout: intent.subject };
  } else if (intent.intent === "log_symptom") {
    // Upsert today's daily_checkin with the inferred fields. The
    // classifier returns free-form keys ({sleep_quality: 6, mood: 3}),
    // so whitelist: mood/energy/stress are real 1-5 columns; anything
    // else numeric goes into the `data` jsonb instead of being spread
    // into the row (an unknown column fails the whole upsert).
    const { columns, extras } = splitSymptomFields(intent.fields);
    if (Object.keys(columns).length > 0 || Object.keys(extras).length > 0) {
      const { data: existing, error: readErr } = await supabase
        .from("daily_checkins")
        .select("data, notes")
        .eq("user_id", user.id)
        .eq("date", today)
        .eq("checkin_window", "general")
        .maybeSingle();
      if (readErr) console.error("capture: daily_checkins read", readErr);
      const prevData =
        (existing?.data as Record<string, unknown> | null | undefined) ?? {};
      const prevNotes = (existing?.notes as string | null | undefined) ?? null;
      const { error: upsertErr } = await supabase.from("daily_checkins").upsert(
        {
          user_id: user.id,
          date: today,
          checkin_window: "general",
          ...columns,
          data: { ...prevData, ...extras },
          notes: prevNotes ? `${prevNotes}\n${text}` : text,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,date,checkin_window" },
      );
      if (upsertErr) {
        console.error("capture: daily_checkins upsert", upsertErr);
        return NextResponse.json(
          { error: "Couldn't save that check-in" },
          { status: 500 },
        );
      }
      executedAction = "log_symptom";
      actionData = { fields: { ...columns, ...extras } };
    } else {
      // No structured fields — fall back to voice memo
      const { error: memoErr } = await supabase.from("voice_memos").insert({
        user_id: user.id,
        transcript: text,
        context_tag: "symptom",
      });
      if (memoErr) console.error("capture: voice_memos insert", memoErr);
      executedAction = "voice_memo";
    }
  } else if (intent.intent === "voice_memo") {
    const { error: memoErr } = await supabase.from("voice_memos").insert({
      user_id: user.id,
      transcript: text,
      context_tag: body.hint ?? null,
    });
    if (memoErr) console.error("capture: voice_memos", memoErr);
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

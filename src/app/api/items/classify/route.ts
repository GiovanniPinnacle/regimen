// Auto-classify an item by name. User types "magnesium glycinate" → we
// return suggested item_type, timing_slot, category, goals, schedule_rule
// + a one-line reasoning so the user knows why we picked that.
//
// User can override anything before saving — we just save them from
// thinking through 6 dropdowns for every new item.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getAnthropic,
  MODELS,
  MODEL_OPTS,
  parseJsonResponse,
  llmErrorResponse,
  jsonSchemaFormat,
} from "@/lib/anthropic";
import { jsonError, readJson, internalError } from "@/lib/api";
import { rateLimitOrError, recordUsage } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

type Body = {
  name: string;
  brand?: string;
};

const SYSTEM = `You are a classifier for the Regimen health-protocol app. Given an item name (and optional brand), return a JSON object with these EXACT keys:

{
  "item_type": "supplement" | "topical" | "device" | "procedure" | "practice" | "food" | "gear" | "test",
  "timing_slot": "pre_breakfast" | "breakfast" | "pre_workout" | "lunch" | "dinner" | "pre_bed" | "ongoing" | "situational",
  "category": "permanent" | "temporary" | "cycled" | "situational" | "condition_linked",
  "goals": [array of: "hair" | "sleep" | "gut" | "foundational" | "metabolic" | "cortisol" | "inflammation" | "circulation" | "testosterone" | "skin_joints" | "AGA" | "seb_derm" | "longevity" | "recovery"],
  "frequency": "daily" | "weekly" | "cycle_8_2" | "situational" | "as_needed" | "ongoing",
  "dose_default": "typical effective dose as a string, or empty string if unknown",
  "reasoning": "one short sentence — why these choices"
}

CLASSIFICATION RULES:
- Magnesium / glycine / apigenin / chamomile → pre_bed, sleep
- Vitamin D3 / K2 / B-complex / multivitamin → breakfast (with food), foundational
- Caffeine pills / pre-workout / creatine → pre_workout
- Omega-3 / probiotics / digestive enzymes → with meal (breakfast or dinner), foundational
- Topical scalp treatments (minoxidil, finasteride, ketoconazole) → topical type, AGA/seb_derm/hair goals
- Microneedling / red light / massage → practice, ongoing
- Bloodwork / panels → test type, situational
- Sauna / cold plunge / breathwork → practice, ongoing
- Coffee / bone broth / specific food → food type, ongoing or relevant meal
- Saline spray / HOCl / lidocaine → topical, ongoing
- Foam roller / weights / equipment → gear
- Workouts (squat, bench, pull-ups) → practice, ongoing

CATEGORY DEFAULTS:
- permanent: foundational supps, lifelong practices, daily habits
- temporary: short-term protocols (post-op, antibiotic course, healing window)
- cycled: things you on/off (Tongkat 8-on/2-off, retinoids, peak weeks)
- situational: only-when-needed (allergy meds, lidocaine for itch)
- condition_linked: tied to a flare (seb derm shampoo when scalp flares)

Reply with JUST the JSON object, no surrounding text or markdown fences.`;

// Structured outputs: the API constrains the response to this schema,
// so enums can't drift and there's no fence-stripping.
const CLASSIFICATION_SCHEMA = {
  type: "object",
  properties: {
    item_type: {
      type: "string",
      enum: ["supplement", "topical", "device", "procedure", "practice", "food", "gear", "test"],
    },
    timing_slot: {
      type: "string",
      enum: ["pre_breakfast", "breakfast", "pre_workout", "lunch", "dinner", "pre_bed", "ongoing", "situational"],
    },
    category: {
      type: "string",
      enum: ["permanent", "temporary", "cycled", "situational", "condition_linked"],
    },
    goals: {
      type: "array",
      items: {
        type: "string",
        enum: [
          "hair", "sleep", "gut", "foundational", "metabolic", "cortisol",
          "inflammation", "circulation", "testosterone", "skin_joints", "AGA",
          "seb_derm", "longevity", "recovery",
        ],
      },
    },
    frequency: {
      type: "string",
      enum: ["daily", "weekly", "cycle_8_2", "situational", "as_needed", "ongoing"],
    },
    dose_default: { type: "string" },
    reasoning: { type: "string" },
  },
  required: ["item_type", "timing_slot", "category", "goals", "frequency", "dose_default", "reasoning"],
  additionalProperties: false,
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("unauthorized", "Not signed in", 401);

  const parsedBody = await readJson<Body>(request);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data;
  if (!body.name || body.name.trim().length < 2) {
    return NextResponse.json(
      { error: "Name too short to classify" },
      { status: 400 },
    );
  }

  const limited = await rateLimitOrError(user.id, "coach");
  if (limited) return limited;

  const anthropic = getAnthropic();
  const userMsg = body.brand
    ? `Item name: ${body.name}\nBrand: ${body.brand}`
    : `Item name: ${body.name}`;

  try {
    const res = await anthropic.messages.create({
      ...MODEL_OPTS.chat,
      max_tokens: 1024,
      output_config: jsonSchemaFormat(CLASSIFICATION_SCHEMA),
      system: SYSTEM,
      messages: [{ role: "user", content: userMsg }],
    });

    void recordUsage(user.id, "coach", {
      route: "/api/items/classify",
      model: MODELS.chat,
      tokens_in: res.usage?.input_tokens,
      tokens_out: res.usage?.output_tokens,
    });

    const parsed = parseJsonResponse(res);

    return NextResponse.json({ ok: true, classification: parsed });
  } catch (e) {
    return llmErrorResponse(e) ?? internalError("/api/items/classify", e);
  }
}

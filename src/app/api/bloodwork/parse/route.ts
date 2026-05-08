// /api/bloodwork/parse — Claude Vision extracts biomarkers from a
// bloodwork photo or PDF page. Returns structured JSON the client
// renders as a review sheet (user confirms before insert).
//
// Two paths:
//   - Photo (image_base64) → vision call extracts text + values
//   - Text (parsed_text) → text-only extraction, faster + cheaper
//     for OCRed PDFs / typed reports
//
// Why a review step instead of auto-insert: lab reports often have
// 30-50 markers; the user only cares about a subset. Letting them
// scan the parse, edit, and confirm before insert keeps the data
// clean.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropic, MODELS } from "@/lib/anthropic";
import { rateLimitOrError, recordUsage } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Reject base64 payloads larger than ~6MB to prevent runaway vision
 *  costs and 60s timeouts. Lab reports are typically a single page —
 *  6MB of base64 = ~4.5MB raw image, plenty for a phone-camera shot. */
const MAX_IMAGE_BASE64_BYTES = 6_000_000;

type Body = {
  image_base64?: string;
  image_mime?: string;
  parsed_text?: string;
  /** Optional — biases the parser. */
  source?: "function" | "quest" | "labcorp" | "manual" | "other";
};

const PARSE_SYSTEM = `You are a bloodwork parser. The user is uploading a lab report. Extract every biomarker with confidence.

Return JSON only:
{
  "drawn_on": "<YYYY-MM-DD or null if unclear>",
  "lab_source": "<function|quest|labcorp|other or null>",
  "panels": [<short panel names like "CBC", "CMP", "Lipid Panel", or null>],
  "biomarkers": [
    {
      "name": "<canonical snake_case: vitamin_d_25oh, ferritin, hba1c, ldl_c, alt, ast, tsh, free_t3, free_t4, total_testosterone, free_testosterone, shbg, cortisol_am, etc.>",
      "display_name": "<as printed on report — e.g. '25-Hydroxy Vitamin D'>",
      "value": <number>,
      "unit": "<ng/dL, mg/dL, %, IU/L, etc.>",
      "reference_range": "<e.g. '40-100' or '<200' or '>15'>",
      "flag": "<H | L | N | null — H if above range, L if below>",
      "panel": "<which panel it belongs to, or null>"
    }
  ]
}

Rules:
- Canonical names use snake_case. Always lowercase.
- Use 25oh for 25-hydroxy variants.
- Standardize cholesterol: total_cholesterol, ldl_c, hdl_c, triglycerides, non_hdl_c.
- For multi-fraction tests: tsh, free_t3, free_t4, reverse_t3, total_t3, total_t4, anti_tpo.
- For testosterone: total_testosterone, free_testosterone, shbg, dhea_s, e2 (estradiol).
- For inflammation: hs_crp (high-sensitivity CRP), homocysteine.
- For metabolic: glucose_fasting, hba1c, insulin_fasting, homa_ir.
- Extract EVERY biomarker the report shows — even ones in normal range.
- If you can't read a value with confidence, omit that row. Don't guess.
- If the report has multiple draw dates (e.g. comparison columns), use the MOST RECENT date.

Output JSON only, no preamble.`;

type ParseResult = {
  drawn_on: string | null;
  lab_source: string | null;
  panels: string[];
  biomarkers: Array<{
    name: string;
    display_name: string;
    value: number;
    unit: string;
    reference_range: string | null;
    flag: string | null;
    panel: string | null;
  }>;
};

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
  if (!body.image_base64 && !body.parsed_text) {
    return NextResponse.json(
      { error: "Provide image_base64 or parsed_text" },
      { status: 400 },
    );
  }

  // Image size cap — both protects against accidental 50MB phone
  // shots and rules out scripted abuse trying to maximize Vision
  // token cost.
  if (body.image_base64 && body.image_base64.length > MAX_IMAGE_BASE64_BYTES) {
    return NextResponse.json(
      {
        error:
          "Image too large. Please retake at lower resolution or crop the page.",
      },
      { status: 413 },
    );
  }

  // Per-user rate limit — vision is the most expensive bucket
  // (~$0.10 per call); cap at 10/24h to keep worst-case spend bounded.
  const limited = await rateLimitOrError(user.id, "vision");
  if (limited) return limited;

  const anthropic = getAnthropic();
  // The SDK's narrowed media_type union ("image/jpeg" | "image/png" |
  // "image/gif" | "image/webp") rejects a generic string. Coerce
  // unknowns to image/jpeg.
  const SDK_IMAGE_MIMES = new Set([
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
  ]);
  type SdkMessages = Parameters<
    typeof anthropic.messages.create
  >[0]["messages"];
  let messages: SdkMessages;

  if (body.image_base64) {
    // Strip data URL prefix if present
    const raw = body.image_base64.replace(/^data:[^,]+;base64,/, "");
    const mime = body.image_mime ?? "image/jpeg";
    const safeMime = (
      SDK_IMAGE_MIMES.has(mime) ? mime : "image/jpeg"
    ) as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
    messages = [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: safeMime,
              data: raw,
            },
          },
          {
            type: "text",
            text: "Parse every biomarker from this lab report.",
          },
        ],
      },
    ];
  } else {
    messages = [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Parse every biomarker from this lab report text:\n\n${body.parsed_text}`,
          },
        ],
      },
    ];
  }

  let result: ParseResult;
  try {
    const res = await anthropic.messages.create({
      model: MODELS.vision,
      max_tokens: 4096,
      system: PARSE_SYSTEM,
      messages,
    });
    const block = res.content[0];
    if (!block || block.type !== "text") {
      return NextResponse.json(
        { error: "Empty parse response" },
        { status: 500 },
      );
    }
    const raw = block.text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    result = JSON.parse(raw) as ParseResult;
    void recordUsage(user.id, "vision", {
      route: "/api/bloodwork/parse",
      model: MODELS.vision,
      tokens_in: res.usage?.input_tokens,
      tokens_out: res.usage?.output_tokens,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Parse failed: ${(e as Error).message}` },
      { status: 500 },
    );
  }

  // Defaults — drawn_on falls back to today if Coach couldn't read it
  if (!result.drawn_on) {
    result.drawn_on = new Date().toISOString().slice(0, 10);
  }
  if (!Array.isArray(result.biomarkers)) {
    result.biomarkers = [];
  }

  return NextResponse.json({
    ok: true,
    parse: result,
    /** Whether the parser flagged enough confidence — UI uses this
     *  to decide if it should auto-insert vs require review. For
     *  now, always require review. */
    confidence: result.biomarkers.length > 0 ? "review" : "low",
  });
}

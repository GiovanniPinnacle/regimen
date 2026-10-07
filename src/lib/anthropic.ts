// Server-side Anthropic SDK client.
// ONLY import from server components, route handlers, or server actions.
// The API key never reaches the client bundle.

import Anthropic from "@anthropic-ai/sdk";

export function getAnthropic() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");
  return new Anthropic({ apiKey: key });
}

// Default models — adjust here to tune cost/quality
export const MODELS = {
  chat: "claude-sonnet-5-5" as const,
  vision: "claude-sonnet-5-5" as const,
  deep: "claude-opus-5-5" as const,
};

// Request presets — spread into messages.create / messages.stream.
//
// Sonnet 5.5 thinks by default and rejects `thinking: {type: "disabled"}`.
// The short JSON/classification routes were written for a no-thinking
// model with tight max_tokens, so `between_tools` keeps them thinking-off
// (it's only valid at effort `high` or below, which is the default).
//
// Coach chat gets adaptive thinking at low effort — better answers,
// minimal added latency. Deep research runs Opus 5.5 at high effort
// (its default is `medium`).
export const MODEL_OPTS = {
  chat: { model: MODELS.chat, thinking: { type: "between_tools" } },
  vision: { model: MODELS.vision, thinking: { type: "between_tools" } },
  coach: {
    model: MODELS.chat,
    thinking: { type: "adaptive" },
    output_config: { effort: "low" },
  },
  deep: {
    model: MODELS.deep,
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
  },
} as const satisfies Record<
  string,
  Pick<Anthropic.MessageCreateParams, "model" | "thinking" | "output_config">
>;

/** Concatenate every text block in a response. With thinking on, the
 *  first content block may be a `thinking` block, so never read
 *  `content[0]` directly. */
export function textOf(res: Anthropic.Message): string {
  let out = "";
  for (const block of res.content) {
    if (block.type === "text") out += block.text;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Response guards + JSON helpers shared by every LLM route.
// ---------------------------------------------------------------------------

/** Thrown when a response stopped for a reason that makes its content
 *  unusable: `max_tokens` (truncated — JSON would be cut mid-object) or
 *  `refusal` (safety classifier declined; content may be empty/partial). */
export class LLMStopError extends Error {
  constructor(
    public readonly reason: "max_tokens" | "refusal",
    message?: string,
  ) {
    super(message ?? `LLM stopped: ${reason}`);
    this.name = "LLMStopError";
  }
}

/** Thrown when a completed response did not contain parseable JSON. */
export class LLMJsonError extends Error {
  constructor(
    message: string,
    public readonly raw: string,
  ) {
    super(message);
    this.name = "LLMJsonError";
  }
}

/** Throw LLMStopError unless the model finished normally. Call before
 *  reading `content` on any route that depends on a complete answer. */
export function assertCompleted(res: Anthropic.Message): void {
  if (res.stop_reason === "max_tokens") throw new LLMStopError("max_tokens");
  if (res.stop_reason === "refusal") throw new LLMStopError("refusal");
}

/** Pull the JSON payload out of free-form model text: strips ```json
 *  fences, then returns the first balanced {...} or [...] span (string-
 *  and escape-aware, so braces inside strings don't confuse it). Falls
 *  back to the trimmed input when nothing balanced is found. */
export function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const text = (fenced ? fenced[1] : raw).trim();
  const start = text.search(/[[{]/);
  if (start < 0) return text;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return text.slice(start);
}

/** assertCompleted + extract + JSON.parse. Throws LLMStopError or
 *  LLMJsonError — map both to HTTP with `llmErrorResponse`. */
export function parseJsonResponse<T = unknown>(res: Anthropic.Message): T {
  assertCompleted(res);
  const raw = textOf(res);
  try {
    return JSON.parse(extractJson(raw)) as T;
  } catch {
    throw new LLMJsonError("Model returned malformed JSON", raw);
  }
}

/** Structured-outputs config: constrains the response to `schema`.
 *  Schemas must set `additionalProperties: false` on every object and
 *  list `required` keys. Spread into `output_config`. */
export function jsonSchemaFormat(schema: Record<string, unknown>) {
  return { format: { type: "json_schema" as const, schema } };
}

/** Map LLM helper errors to a JSON Response; returns null for anything
 *  else so callers can fall through to their own handling. */
export function llmErrorResponse(err: unknown): Response | null {
  if (err instanceof LLMStopError) {
    if (err.reason === "refusal") {
      return Response.json(
        {
          error:
            "Coach can't help with that one. Try rephrasing, or ask about something else in your regimen.",
          code: "refusal",
        },
        { status: 422 },
      );
    }
    return Response.json(
      {
        error: "The AI response was cut off before it finished. Please try again.",
        code: "truncated",
      },
      { status: 502 },
    );
  }
  if (err instanceof LLMJsonError) {
    console.error("LLM JSON parse failed, raw:", err.raw.slice(0, 500));
    return Response.json(
      { error: "The AI returned an unreadable response. Please try again.", code: "bad_llm_json" },
      { status: 502 },
    );
  }
  if (err instanceof Anthropic.RateLimitError) {
    return Response.json(
      { error: "The AI service is busy. Try again in a minute.", code: "upstream_rate_limited" },
      { status: 503 },
    );
  }
  if (err instanceof Anthropic.APIError) {
    console.error("Anthropic API error", err.status, err.message);
    return Response.json(
      { error: "The AI service had a problem. Please try again.", code: "upstream_error" },
      { status: 502 },
    );
  }
  return null;
}

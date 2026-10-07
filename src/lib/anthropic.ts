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

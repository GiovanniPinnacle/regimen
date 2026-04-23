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
  chat: "claude-sonnet-4-5" as const,
  vision: "claude-sonnet-4-5" as const,
  deep: "claude-opus-4-5" as const,
};

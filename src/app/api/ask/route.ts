// Coach — streaming chat endpoint. (Persona: Coach. Model: Claude Sonnet.)
// POST { messages: Array<{role, content}> } → streaming text
// Content can be a plain string OR an array of multimodal parts
// ({ type: "text" | "image", ... }) so users can send photos.

import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropic, MODELS, MODEL_OPTS } from "@/lib/anthropic";
import { rateLimitOrError, recordUsage } from "@/lib/rate-limit";
import { buildContextForUser, contextToCachedSystem } from "@/lib/context";
import { internalError, jsonError, readJson } from "@/lib/api";
import type {
  MessageParam,
  TextBlockParam,
} from "@anthropic-ai/sdk/resources/messages";

export const runtime = "nodejs";
export const maxDuration = 60;

type InContentPart =
  | { type: "text"; text: string }
  | {
      type: "image";
      source: { type: "base64"; media_type: string; data: string };
    };
type InMsg = {
  role: "user" | "assistant";
  content: string | InContentPart[];
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("unauthorized", "Not signed in", 401);

  const body = await readJson<{ messages?: InMsg[] }>(request);
  if (!body.ok) return body.response;
  const inMessages = body.data.messages;
  if (!Array.isArray(inMessages) || inMessages.length === 0) {
    return jsonError("bad_request", "Missing messages", 400);
  }

  const limited = await rateLimitOrError(user.id, "coach");
  if (limited) return limited;

  // Prompt caching: system renders stable → profile → volatile. The
  // first two blocks are identical across a user's turns (persona +
  // rules; stack/profile/bloodwork) and carry cache breakpoints, so
  // later turns read them at ~10% of the input price. The volatile block
  // (today's date + day-to-day logs) sits after the last breakpoint so
  // it never invalidates the cached prefix.
  let system: TextBlockParam[];
  try {
    system = contextToCachedSystem(await buildContextForUser(user.id));
  } catch (err) {
    return internalError("/api/ask context", err);
  }

  const anthropic = getAnthropic();
  const messages: MessageParam[] = inMessages.map((m) => ({
    role: m.role,
    content: m.content as MessageParam["content"],
  }));

  // Stream response — also accumulate the assistant text so we can
  // persist the turn to claude_conversations after the stream closes.
  // We persist text-only (no inline base64 images) so storage stays
  // lean. The most recent user message + Coach's reply land as a single
  // jsonb row keyed by user_id + created_at; future memory features
  // (recall, fact extraction) can read off this archive.
  const encoder = new TextEncoder();
  let assistantText = "";
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const res = anthropic.messages.stream({
          ...MODEL_OPTS.coach,
          max_tokens: 8000,
          system,
          messages,
        });

        for await (const event of res) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const chunk = event.delta.text;
            assistantText += chunk;
            controller.enqueue(encoder.encode(chunk));
          }
        }

        // The stream is fully consumed, so finalMessage() resolves
        // immediately. Check why it stopped before closing.
        const final = await res.finalMessage();
        if (final.stop_reason === "refusal") {
          const note = assistantText
            ? "\n\n[Coach stopped here — that's outside what I can help with.]"
            : "Coach can't help with that one. Try rephrasing, or ask about something else in your regimen.";
          controller.enqueue(encoder.encode(note));
        } else if (final.stop_reason === "max_tokens") {
          controller.enqueue(
            encoder.encode("\n\n[Response cut off — ask me to continue.]"),
          );
        }
        controller.close();

        void recordUsage(user.id, "coach", {
          route: "/api/ask",
          model: MODELS.chat,
          tokens_in:
            (final.usage?.input_tokens ?? 0) +
            (final.usage?.cache_read_input_tokens ?? 0) +
            (final.usage?.cache_creation_input_tokens ?? 0),
          tokens_out: final.usage?.output_tokens,
        }).catch((e) => console.error("ask/route recordUsage error", e));

        // Best-effort persist — fire-and-forget so it never delays the
        // response. Failures are logged but don't break chat.
        if (assistantText) {
          void persistTurn(supabase, user.id, inMessages, assistantText).catch(
            (e) => console.error("ask/route persist error", e),
          );
        }
      } catch (err) {
        console.error("ask/route streaming error", err);
        try {
          controller.enqueue(
            encoder.encode("\n\n[Coach hit a snag — please try again.]"),
          );
          controller.close();
        } catch {
          // Stream already closed/cancelled by the client.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** Strip base64 image data from message parts before storage — we keep
 *  the alt-text/note but drop the binary payload. Otherwise a single
 *  meal photo would balloon a row to ~2 MB. */
function stripImages(content: InMsg["content"]): string | InContentPart[] {
  if (typeof content === "string") return content;
  return content.map((p) => {
    if (p.type === "image") {
      return {
        type: "text" as const,
        text: "[image attached, not stored]",
      };
    }
    return p;
  });
}

async function persistTurn(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  inMessages: InMsg[],
  assistantText: string,
): Promise<void> {
  // Keep only the LAST user turn — that's the new question this round.
  // The full prior thread lives in earlier rows.
  const lastUser = [...inMessages].reverse().find((m) => m.role === "user");
  if (!lastUser) return;
  const messages_json = {
    user: stripImages(lastUser.content),
    assistant: assistantText,
  };
  const { error } = await supabase.from("claude_conversations").insert({
    user_id: userId,
    messages_json,
  });
  if (error) throw error;
}

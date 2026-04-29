// Coach — streaming chat endpoint. (Persona: Coach. Model: Claude Sonnet.)
// POST { messages: Array<{role, content}> } → streaming text
// Content can be a plain string OR an array of multimodal parts
// ({ type: "text" | "image", ... }) so users can send photos.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropic, MODELS } from "@/lib/anthropic";
import {
  buildContextForCurrentUser,
  contextToSystemPrompt,
} from "@/lib/context";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";

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
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json()) as { messages: InMsg[] };
  if (!body.messages || body.messages.length === 0) {
    return NextResponse.json({ error: "Missing messages" }, { status: 400 });
  }

  const ctx = await buildContextForCurrentUser();
  const system = contextToSystemPrompt(ctx);

  const anthropic = getAnthropic();
  const messages: MessageParam[] = body.messages.map((m) => ({
    role: m.role,
    content: m.content as MessageParam["content"],
  }));

  // Stream response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const res = await anthropic.messages.stream({
          model: MODELS.chat,
          max_tokens: 2048,
          system,
          messages,
        });

        for await (const event of res) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const chunk = event.delta.text;
            controller.enqueue(encoder.encode(chunk));
          }
        }
        controller.close();
      } catch (err) {
        console.error("ask/route streaming error", err);
        controller.enqueue(
          encoder.encode(
            `\n\n[Coach hit a snag: ${(err as Error).message}]`,
          ),
        );
        controller.close();
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

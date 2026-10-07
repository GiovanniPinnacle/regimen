"use client";

// Conversation state machine for Coach: messages, streaming, proposal
// execution, photo attachment, and sessionStorage persistence.
//
// Persistence strips base64 image parts — a single phone photo is
// several MB and would blow the ~5MB sessionStorage quota (and re-send
// the photo on every later turn after a reload).

import { useCallback, useEffect, useRef, useState } from "react";
import type { Proposal } from "@/lib/proposals";
import { showToast } from "@/lib/toast";
import type { ContentPart, ExecState, Msg, PendingImage } from "./types";

const STORAGE_KEY = "regimen.coach.conversation.v1";
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

function stripImages(msgs: Msg[]): Msg[] {
  return msgs.map((m) => {
    if (typeof m.content === "string") return m;
    const parts = m.content.filter(
      (p): p is Extract<ContentPart, { type: "text" }> => p.type === "text",
    );
    if (parts.length === m.content.length) return m;
    return {
      ...m,
      content: parts.length > 0 ? parts : "(photo)",
    };
  });
}

function readStored(): Msg[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Msg[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function useCoachChat() {
  const [messages, setMessages] = useState<Msg[]>(readStored);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [executed, setExecuted] = useState<Record<string, ExecState>>({});
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Latest thread for callbacks fired from events / chips, without
  // re-binding them on every streamed chunk.
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Persist conversation (minus photos).
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stripImages(messages)));
    } catch {}
  }, [messages]);

  const sendNow = useCallback(async (msgs: Msg[]) => {
    setLoading(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let acc = "";
    let raf = 0;
    const flush = () => {
      raf = 0;
      setMessages([...msgs, { role: "assistant", content: acc }]);
    };
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: msgs }),
        signal: ctrl.signal,
      });
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      setMessages([...msgs, { role: "assistant", content: "" }]);
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        // Coalesce chunk renders to one per frame — smoother streaming
        // and far fewer markdown re-parses on fast connections.
        if (!raf) raf = requestAnimationFrame(flush);
      }
      if (raf) cancelAnimationFrame(raf);
      flush();
    } catch (err) {
      if (raf) cancelAnimationFrame(raf);
      if ((err as Error).name === "AbortError") {
        // Stopped by the user — keep whatever streamed so far.
        if (acc) setMessages([...msgs, { role: "assistant", content: acc }]);
        else setMessages(msgs);
      } else {
        setMessages((m) => [
          ...m.filter((x, i) => !(i === m.length - 1 && x.role === "assistant" && x.content === "")),
          {
            role: "assistant",
            content: "I couldn't reach Coach just now. Check your connection and try again.",
          },
        ]);
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  /** Append a user message and send the whole thread. Pass `fresh`
   *  to start a new thread with just this message. */
  const sendText = useCallback(
    (text: string, fresh = false) => {
      const next: Msg[] = [
        ...(fresh ? [] : messagesRef.current),
        { role: "user", content: text },
      ];
      messagesRef.current = next;
      setMessages(next);
      void sendNow(next);
    },
    [sendNow],
  );

  const handleSend = useCallback(() => {
    const text = input.trim();
    if ((!text && !pendingImage) || loading) return;
    setInput("");

    // Build user message — multimodal if there's a pending image
    let userMsg: Msg;
    if (pendingImage) {
      userMsg = {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: pendingImage.mediaType,
              data: pendingImage.data,
            },
          },
          { type: "text", text: text || "What do you see? How does this fit my regimen?" },
        ],
      };
      setPendingImage(null);
    } else {
      userMsg = { role: "user", content: text };
    }

    const next = [...messages, userMsg];
    setMessages(next);
    void sendNow(next);
  }, [input, pendingImage, loading, messages, sendNow]);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setExecuted({});
    setPendingImage(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

  const approve = useCallback(async (proposal: Proposal) => {
    setExecuted((m) => ({ ...m, [proposal.id]: "pending" }));
    try {
      const res = await fetch("/api/proposals/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: proposal.action,
          item_name: proposal.item_name,
          reasoning: proposal.reasoning,
          extra: proposal.extra,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setExecuted((m) => ({ ...m, [proposal.id]: "done" }));
        showToast(`Applied: ${proposal.item_name}`, { tone: "success" });
        // Tell every page that lists items to refresh.
        window.dispatchEvent(new CustomEvent("regimen:items-changed"));
      } else {
        setExecuted((m) => ({ ...m, [proposal.id]: "error" }));
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: `Couldn't apply that change: ${data.error ?? "something went wrong"}`,
          },
        ]);
      }
    } catch {
      setExecuted((m) => ({ ...m, [proposal.id]: "error" }));
    }
  }, []);

  const dismiss = useCallback((proposal: Proposal) => {
    setExecuted((m) => ({ ...m, [proposal.id]: "error" }));
  }, []);

  /** Photo → base64 inline. No storage round-trip for transient chat. */
  const attachPhoto = useCallback((file: File) => {
    if (file.size > MAX_PHOTO_BYTES) {
      showToast("That photo is too large — 5 MB max.", { tone: "error" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [meta, data] = result.split(",");
      const mediaType = meta.match(/data:([^;]+);base64/)?.[1] ?? "image/jpeg";
      setPendingImage({ data, mediaType, preview: result });
    };
    reader.readAsDataURL(file);
  }, []);

  return {
    messages,
    setMessages,
    input,
    setInput,
    loading,
    executed,
    pendingImage,
    setPendingImage,
    sendNow,
    sendText,
    handleSend,
    stop,
    clear,
    approve,
    dismiss,
    attachPhoto,
  };
}

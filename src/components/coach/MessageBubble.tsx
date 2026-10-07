"use client";

// One turn in the thread. User turns are right-aligned neutral bubbles;
// Coach turns are unbubbled, full-width prose (the ChatGPT / Claude iOS
// pattern) followed by any proposal cards.

import { useState } from "react";
import { parseProposals, stripProposals, type Proposal } from "@/lib/proposals";
import Icon from "@/components/Icon";
import CoachMarkdown from "@/components/CoachMarkdown";
import ProposalCard from "./ProposalCard";
import type { ExecState, Msg } from "./types";

// Above this, Coach prose collapses to its first few paragraphs so the
// proposal card underneath stays one tap away.
const COLLAPSE_THRESHOLD = 480;

/** Short label for long programmatic prompts (lenses, Next-step CTAs)
 *  so the user's own bubble isn't a wall of instructions. */
function compactUserLabel(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length < 90) return null;
  if (trimmed.includes("?") && trimmed.length < 140) return null;
  const first = trimmed.split(/[.\n]/)[0].trim();
  if (first.length <= 80) return first;
  const cut = first.slice(0, 80).split(" ").slice(0, -1).join(" ");
  return (cut.length > 30 ? cut : first.slice(0, 77)) + "…";
}

function collapse(text: string) {
  const blocks = text.split(/\n{2,}/);
  let out = "";
  for (const b of blocks) {
    if (out.length + b.length > 280 && out.length > 0) break;
    out += (out ? "\n\n" : "") + b;
    if (out.length > 280) break;
  }
  return out;
}

function AssistantText({ text, streaming }: { text: string; streaming: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const long = !streaming && text.length > COLLAPSE_THRESHOLD;
  const shown = long && !expanded ? collapse(text) : text;
  return (
    <div className="w-full text-body text-[var(--foreground)]">
      <CoachMarkdown text={shown} />
      {long && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 -ml-1 inline-flex min-h-[44px] items-center gap-1 px-1 text-footnote font-semibold text-[var(--pro-soft)]"
        >
          {expanded ? "Show less" : "Show more"}
          <Icon name={expanded ? "chevron-up" : "chevron-down"} size={14} strokeWidth={2.2} />
        </button>
      )}
    </div>
  );
}

export default function MessageBubble({
  msg,
  executed,
  streaming = false,
  onApprove,
  onDismiss,
}: {
  msg: Msg;
  executed: Record<string, ExecState>;
  streaming?: boolean;
  onApprove: (p: Proposal) => void;
  onDismiss: (p: Proposal) => void;
}) {
  const isUser = msg.role === "user";
  const [showFull, setShowFull] = useState(false);

  let displayText = "";
  let imageData: string | null = null;
  if (typeof msg.content === "string") {
    displayText = isUser ? msg.content : stripProposals(msg.content);
  } else {
    for (const part of msg.content) {
      if (part.type === "text") displayText += (displayText ? "\n" : "") + part.text;
      else if (part.type === "image")
        imageData = `data:${part.source.media_type};base64,${part.source.data}`;
    }
    if (!isUser) displayText = stripProposals(displayText);
  }
  const proposals = isUser
    ? []
    : parseProposals(typeof msg.content === "string" ? msg.content : displayText);

  if (isUser) {
    const compactLabel = compactUserLabel(displayText);
    const isCompact = compactLabel !== null && !showFull;
    return (
      <div className="flex flex-col items-end gap-1.5 pl-10">
        {imageData && (
          <img
            src={imageData}
            alt="Attached photo"
            className="block max-h-64 w-auto max-w-[75%] rounded-[18px] border border-[var(--border)] object-cover"
          />
        )}
        {isCompact ? (
          <button
            type="button"
            onClick={() => setShowFull(true)}
            title="Show the full request"
            className="inline-flex min-h-[44px] max-w-full items-center gap-2 rounded-[18px] rounded-br-[6px] border border-[var(--border)] bg-[var(--surface-alt)] px-3.5 text-left text-callout font-medium text-[var(--foreground)]"
          >
            <Icon name="sparkle" size={14} strokeWidth={2} className="shrink-0 text-[var(--pro-soft)]" />
            <span className="truncate">{compactLabel}</span>
          </button>
        ) : (
          displayText && (
            <div className="max-w-full rounded-[18px] rounded-br-[6px] border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-2.5 text-body whitespace-pre-wrap text-[var(--foreground)]">
              {displayText}
            </div>
          )
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-3">
      {displayText && <AssistantText text={displayText} streaming={streaming} />}
      {proposals.map((p) => (
        <ProposalCard
          key={p.id}
          proposal={p}
          state={executed[p.id]}
          onApprove={onApprove}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
}

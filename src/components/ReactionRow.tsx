"use client";

// ReactionRow — RP-style stim/fatigue tag UI on ItemCard.
// Shown after the item has been active long enough that a reaction is meaningful
// (default 7 days; protocols can override via research_summary).
//
// Tap an emoji to set today's reaction. Tap the same emoji again to clear.
// Today's reaction is highlighted. Multiple reactions over time become the
// signal Coach uses for refinement: "no_change ×5 in 30 days → drop candidate."

import { useEffect, useRef, useState } from "react";
import { getReactionForToday, setReaction } from "@/lib/storage";
import {
  REACTION_EMOJI,
  REACTION_LABELS,
  type ReactionType,
} from "@/lib/types";
import { showToast } from "@/lib/toast";

const REACTIONS: ReactionType[] = ["helped", "no_change", "worse", "forgot"];

type Props = {
  itemId: string;
  /** Compact mode hides labels, only emojis. */
  compact?: boolean;
};

export default function ReactionRow({ itemId, compact = true }: Props) {
  const [current, setCurrent] = useState<ReactionType | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [notePromptFor, setNotePromptFor] = useState<ReactionType | null>(
    null,
  );
  const [noteText, setNoteText] = useState("");
  const noteInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await getReactionForToday(itemId);
      if (!alive) return;
      setCurrent(r?.reaction ?? null);
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, [itemId]);

  useEffect(() => {
    if (notePromptFor) {
      // Small delay so the row renders before focus
      setTimeout(() => noteInputRef.current?.focus(), 50);
    }
  }, [notePromptFor]);

  async function pick(r: ReactionType, e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    const newVal = current === r ? null : r;
    // Optimistic
    setCurrent(newVal);
    if (newVal) {
      await setReaction(itemId, newVal);
      // For "worse", surface an inline note prompt so the user can capture
      // why — that's the highest-value signal for refinement.
      if (newVal === "worse") {
        setNotePromptFor("worse");
      } else {
        setNotePromptFor(null);
      }
    } else {
      setNotePromptFor(null);
    }
  }

  async function saveNote() {
    if (!notePromptFor || !noteText.trim()) {
      setNotePromptFor(null);
      return;
    }
    await setReaction(itemId, notePromptFor, noteText.trim());
    setNotePromptFor(null);
    setNoteText("");
    showToast("Note saved", { tone: "success", duration: 2000 });
  }

  if (!loaded) return null;

  return (
    <div className="mt-2">
      <div className="flex items-center gap-1.5">
        <span
          className="text-[10px] uppercase tracking-wider"
          style={{ color: "var(--muted)", fontWeight: 500 }}
        >
          Today:
        </span>
        {REACTIONS.map((r) => {
          const active = current === r;
          return (
            <button
              key={r}
              onClick={(e) => pick(r, e)}
              className="px-2 py-1 rounded-full transition-all flex items-center gap-1"
              style={{
                background: active ? "var(--olive)" : "transparent",
                border: active
                  ? "1px solid var(--olive)"
                  : "1px solid var(--border)",
                color: active ? "#FBFAF6" : "var(--muted)",
                fontSize: compact ? "13px" : "14px",
                minHeight: "26px",
              }}
              title={REACTION_LABELS[r]}
              aria-label={REACTION_LABELS[r]}
              aria-pressed={active}
            >
              <span className="leading-none">{REACTION_EMOJI[r]}</span>
              {!compact && (
                <span className="text-[11px]" style={{ fontWeight: 500 }}>
                  {REACTION_LABELS[r]}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {notePromptFor === "worse" && (
        <div
          className="mt-2 flex gap-1.5 items-center"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            ref={noteInputRef}
            type="text"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void saveNote();
              } else if (e.key === "Escape") {
                setNotePromptFor(null);
                setNoteText("");
              }
            }}
            placeholder="What's worse? (e.g. headache, nausea, mood)"
            className="flex-1 text-[12px] px-3 py-1.5 rounded-lg"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            }}
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              void saveNote();
            }}
            className="text-[12px] px-3 py-1.5 rounded-lg"
            style={{
              background: "var(--olive)",
              color: "#FBFAF6",
              fontWeight: 500,
            }}
          >
            Save
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setNotePromptFor(null);
              setNoteText("");
            }}
            className="text-[12px] px-2"
            style={{ color: "var(--muted)" }}
          >
            Skip
          </button>
        </div>
      )}
    </div>
  );
}

/** Determine whether to show ReactionRow on a given item — gate by days active. */
export function shouldShowReaction(
  item: { started_on?: string; research_summary?: string | null },
): boolean {
  if (!item.started_on) return false;
  const start = new Date(item.started_on);
  const days = Math.floor((Date.now() - start.getTime()) / 86400000);
  // Default minimum window: 7 days. We could parse research_summary for a
  // specific time-to-effect later (e.g., "30 days for finasteride") but for
  // v1, 7 days is a safe floor — if users haven't reacted by day 7 they
  // never will, and < 7d reactions are too noisy to act on.
  return days >= 7;
}

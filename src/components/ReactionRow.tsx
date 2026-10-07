"use client";

// ReactionRow — RP-style stim/fatigue tag UI on ItemCard.
// Shown after the item has been active long enough that a reaction is meaningful
// (default 7 days; protocols can override via research_summary).
//
// Tap an icon to set today's reaction. Tap the same icon again to clear.
// Today's reaction is highlighted. Multiple reactions over time become the
// signal Coach uses for refinement: "no_change ×5 in 30 days → drop candidate."

import { useEffect, useRef, useState } from "react";
import { getReactionForToday, setReaction } from "@/lib/storage";
import { REACTION_LABELS, type ReactionType } from "@/lib/types";
import { showToast } from "@/lib/toast";
import Icon, { type IconName } from "@/components/Icon";
import Button from "@/components/ui/Button";

const REACTION_ICON: Record<ReactionType, IconName> = {
  helped: "thumbs-up",
  no_change: "minus",
  worse: "thumbs-down",
  forgot: "help",
};

const REACTIONS: ReactionType[] = ["helped", "no_change", "worse", "forgot"];

type Props = {
  itemId: string;
  /** Compact mode hides labels, only icons. */
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
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Today's reaction">
        <span className="text-eyebrow uppercase text-[var(--muted)]">Today</span>
        {REACTIONS.map((r) => {
          const active = current === r;
          return (
            <button
              key={r}
              type="button"
              onClick={(e) => pick(r, e)}
              className={`relative inline-flex h-8 items-center gap-1 rounded-full border text-caption font-medium transition-colors active:scale-95 before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-[''] ${
                compact ? "w-9 justify-center" : "px-3"
              } ${
                active
                  ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                  : "border-[var(--border)] bg-transparent text-[var(--muted)]"
              }`}
              title={REACTION_LABELS[r]}
              aria-label={REACTION_LABELS[r]}
              aria-pressed={active}
            >
              <Icon name={REACTION_ICON[r]} size={15} strokeWidth={1.9} />
              {!compact && <span>{REACTION_LABELS[r]}</span>}
            </button>
          );
        })}
      </div>
      {notePromptFor === "worse" && (
        <div
          className="mt-2 flex items-center gap-1.5"
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
            aria-label="What got worse"
            placeholder="What's worse? (e.g. headache, nausea, mood)"
            className="input-field min-w-0 flex-1"
          />
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              void saveNote();
            }}
          >
            Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              setNotePromptFor(null);
              setNoteText("");
            }}
          >
            Skip
          </Button>
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

"use client";

// MilestoneCheckins — the Coach memory loop's user-facing surface.
//
// Renders 0-3 cards on Today asking "How's [item] going at day X?" with
// three quick reaction buttons (👍 Helped · 🤷 No change · 👎 Worse) and
// a "Tell Coach more" link that opens a focused conversation with the
// item's full milestone context pre-loaded.
//
// Each tap saves into item_reactions which Coach reads back during
// future sessions — so by year 2, recommendations draw on real outcome
// data instead of generic biohacker advice. This is the compounding
// asset.
//
// Card stays around for 24h after first reaction so the user can
// always switch their answer or add a note. After 24h it disappears
// from the surface and the data lives in the reaction history.

import { useEffect, useState } from "react";
import { setReaction } from "@/lib/storage";
import { showToast } from "@/lib/toast";
import {
  REACTION_EMOJI,
  REACTION_LABELS,
  type ReactionType,
} from "@/lib/types";

type Checkin = {
  item_id: string;
  item_name: string;
  item_type: string;
  brand: string | null;
  started_on: string;
  days_since_start: number;
  milestone: number;
  offset: number;
  last_reaction: string | null;
  last_reaction_on: string | null;
};

const REACTIONS: ReactionType[] = ["helped", "no_change", "worse"];

export default function MilestoneCheckins() {
  const [checkins, setCheckins] = useState<Checkin[] | null>(null);
  const [reacted, setReactedLocal] = useState<Record<string, ReactionType>>(
    {},
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/coach/milestone-checkins", {
          credentials: "include",
        });
        if (!r.ok) {
          if (alive) setCheckins([]);
          return;
        }
        const j = (await r.json()) as { checkins?: Checkin[] };
        if (alive) setCheckins(j.checkins ?? []);
      } catch {
        if (alive) setCheckins([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function react(c: Checkin, r: ReactionType) {
    setReactedLocal((prev) => ({ ...prev, [c.item_id]: r }));
    try {
      await setReaction(c.item_id, r);
      showToast(`${c.item_name}: ${REACTION_LABELS[r].toLowerCase()} ✓`, {
        tone: r === "worse" ? "warn" : "success",
        duration: 2000,
      });
      // For "worse" especially, prompt Coach to investigate. This is
      // the highest-signal moment — a user just told us something
      // didn't work.
      if (r === "worse") {
        const prompt =
          `${c.item_name} (started ${c.days_since_start} days ago) — I just logged it as making things worse. ` +
          `What could be the issue? Look at my stack for interactions, dose, or timing problems and propose a fix. ` +
          `Use <<<PROPOSAL>>> blocks if you want to suggest a swap or dose change.`;
        window.dispatchEvent(
          new CustomEvent("regimen:ask", {
            detail: { text: prompt, send: true },
          }),
        );
      }
    } catch (e) {
      console.error("Failed to save reaction", e);
      setReactedLocal((prev) => {
        const n = { ...prev };
        delete n[c.item_id];
        return n;
      });
      showToast("Couldn't save", { tone: "error" });
    }
  }

  function tellCoachMore(c: Checkin) {
    const prevContext =
      c.last_reaction && c.last_reaction_on
        ? `(I previously reacted "${c.last_reaction}" on ${c.last_reaction_on}.)`
        : "";
    const prompt =
      `Day-${c.milestone} check-in for **${c.item_name}**. I started it on ${c.started_on} (${c.days_since_start} days ago). ${prevContext}\n\n` +
      `Walk me through what to look for at this milestone. What changes should I notice if it's working? What if it isn't? Should I keep going, adjust dose, or try something else?`;
    window.dispatchEvent(
      new CustomEvent("regimen:ask", {
        detail: { text: prompt },
      }),
    );
  }

  if (!checkins || checkins.length === 0) return null;

  return (
    <section className="mb-5">
      <div className="flex items-baseline justify-between mb-2.5 px-0.5">
        <h2
          className="text-[11px] uppercase tracking-wider"
          style={{
            color: "var(--accent)",
            fontWeight: 700,
            letterSpacing: "0.08em",
          }}
        >
          Coach&apos;s memory · {checkins.length} check-in
          {checkins.length === 1 ? "" : "s"}
        </h2>
      </div>
      <div className="flex flex-col gap-2">
        {checkins.map((c) => {
          const userReacted = reacted[c.item_id];
          const dayLabel =
            c.offset === 0
              ? `Day ${c.milestone}`
              : c.offset > 0
                ? `Day ${c.milestone} +${c.offset}`
                : `Day ${c.milestone} −${Math.abs(c.offset)}`;
          return (
            <div
              key={c.item_id}
              className="rounded-2xl card-glass p-3.5"
              style={{
                borderLeft: "3px solid var(--accent)",
                opacity: userReacted ? 0.7 : 1,
              }}
            >
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <div
                  className="text-[10px] uppercase tracking-wider"
                  style={{
                    color: "var(--accent)",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                  }}
                >
                  {dayLabel} · check-in
                </div>
                {c.last_reaction && (
                  <span
                    className="text-[10px]"
                    style={{ color: "var(--muted)" }}
                  >
                    last said {REACTION_EMOJI[c.last_reaction as ReactionType] ?? ""}
                  </span>
                )}
              </div>
              <div
                className="text-[14.5px] leading-snug"
                style={{ fontWeight: 600 }}
              >
                How&apos;s{" "}
                <span style={{ color: "var(--foreground)" }}>
                  {c.item_name}
                </span>{" "}
                going?
              </div>
              {c.brand && (
                <div
                  className="text-[11.5px] mt-0.5"
                  style={{ color: "var(--muted)" }}
                >
                  {c.brand}
                </div>
              )}
              <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                {REACTIONS.map((r) => {
                  const isPicked = userReacted === r;
                  return (
                    <button
                      key={r}
                      onClick={() => react(c, r)}
                      disabled={Boolean(userReacted)}
                      className="text-[12.5px] px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-all"
                      style={{
                        background: isPicked
                          ? "var(--olive)"
                          : "var(--surface-alt)",
                        color: isPicked ? "#FBFAF6" : "var(--foreground)",
                        border: isPicked
                          ? "1px solid var(--olive)"
                          : "1px solid var(--border)",
                        fontWeight: 600,
                        minHeight: 32,
                        opacity: userReacted && !isPicked ? 0.4 : 1,
                      }}
                    >
                      <span className="leading-none">
                        {REACTION_EMOJI[r]}
                      </span>
                      <span>{REACTION_LABELS[r]}</span>
                    </button>
                  );
                })}
                <button
                  onClick={() => tellCoachMore(c)}
                  className="text-[11.5px] underline ml-auto"
                  style={{ color: "var(--muted)" }}
                >
                  Tell Coach
                </button>
              </div>
              {userReacted === "worse" && (
                <div
                  className="text-[11px] mt-2 leading-relaxed"
                  style={{ color: "var(--accent)" }}
                >
                  Coach is looking into this — check the chat for a proposal.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

"use client";

// Context-aware follow-up suggestions under Coach's latest reply. Chips
// with `send` fire immediately; the rest pre-fill the composer so the
// user can add their own context first.

type Chip = { label: string; text: string; send: boolean };

function chipsFor(lastAssistant: string): Chip[] {
  const lower = lastAssistant.toLowerCase();
  const hasProposal = /<<<proposal|proposal>>>/i.test(lastAssistant);
  const endsWithQuestion = /\?\s*$/.test(lastAssistant.trim());
  const mentionsAdd = /\b(add|queue|try|consider)\b/i.test(lower);
  const mentionsDrop = /\b(drop|retire|remove|stop)\b/i.test(lower);

  if (hasProposal)
    return [
      {
        label: "Why this one?",
        text: "Why this specific item over alternatives? What's the evidence + the trade-offs?",
        send: true,
      },
      {
        label: "Show alternatives",
        text: "What are 2-3 alternatives I should compare against this proposal — different brand, dose, or mechanism?",
        send: true,
      },
      { label: "What about my…", text: "What about my ", send: false },
    ];
  if (endsWithQuestion)
    return [
      { label: "Yes", text: "Yes", send: true },
      { label: "No", text: "No", send: true },
      {
        label: "Tell me more first",
        text: "Tell me more before I answer — what's the trade-off?",
        send: true,
      },
    ];
  if (mentionsAdd)
    return [
      {
        label: "Find a tighter version",
        text: "Is there a tighter version — lower dose, different timing, cheaper brand — that fits better?",
        send: true,
      },
      {
        label: "Pair with what I have?",
        text: "What in my current stack should I pair this with for max effect?",
        send: true,
      },
      {
        label: "Make the case against",
        text: "Make the case for NOT adding this. Where could it go wrong?",
        send: true,
      },
    ];
  if (mentionsDrop)
    return [
      { label: "Drop it", text: "Yes, drop it — emit the proposal.", send: true },
      {
        label: "Reframe instead",
        text: "Before I drop it, what's the smallest behavior change that would make it stick?",
        send: true,
      },
      {
        label: "What replaces it?",
        text: "If I drop it, what do I replace the function of this item with?",
        send: true,
      },
    ];
  return [
    { label: "Why?", text: "Why? Walk me through the reasoning.", send: true },
    {
      label: "What's next?",
      text: "Given my stack + recent data, what's the single highest-leverage next move?",
      send: true,
    },
    { label: "Add my context", text: "", send: false },
  ];
}

export default function FollowUpChips({
  lastAssistant,
  onPick,
}: {
  lastAssistant: string;
  onPick: (text: string, sendIt: boolean) => void;
}) {
  const chips = chipsFor(lastAssistant);
  return (
    <div className="-mt-2 flex flex-wrap gap-2" aria-label="Suggested follow-ups">
      {chips.map((c) => (
        <button
          key={c.label}
          type="button"
          onClick={() => onPick(c.text, c.send)}
          className="no-truncate relative inline-flex h-9 items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 text-footnote font-medium text-[var(--foreground-soft)] transition-colors before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

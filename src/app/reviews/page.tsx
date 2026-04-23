const REVIEWS = [
  { date: "2026-04-30", phase: "Day 14 check-in", actions: "Start curcumin + full omega-3 dose" },
  { date: "2026-05-07", phase: "Day 21 check-in", actions: "Add Procapil serum, resistance training return" },
  { date: "2026-05-14", phase: "Day 28 check-in", actions: "Ketoconazole alternating" },
  { date: "2026-05-21", phase: "Week 5 check-in", actions: "Redwood Max, HIIT return" },
  { date: "2026-06-18", phase: "Week 8–10 bloodwork", actions: "Function Health full panel. PAUSE BIOTIN Jun 15" },
  { date: "2026-07-23", phase: "Month 3 review", actions: "First PRP, reassess gut stack" },
  { date: "2026-10-23", phase: "Month 6 major audit", actions: "Drop temporary stack — reassess Sensolin, Meriva, Testro-X" },
  { date: "2027-04-23", phase: "Month 12 full review", actions: "Regenera Activa repeat, AGA progression assessment" },
];

export default function ReviewsPage() {
  return (
    <div className="pb-24">
      <header className="mb-6">
        <h1 className="text-[26px] leading-tight" style={{ fontWeight: 500 }}>
          Reviews
        </h1>
        <div className="text-[13px] mt-1" style={{ color: "var(--muted)" }}>
          Scheduled checkpoints
        </div>
      </header>

      <div className="flex flex-col gap-2">
        {REVIEWS.map((r) => (
          <div key={r.date} className="border-hair rounded-xl p-4">
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <div className="text-[15px]" style={{ fontWeight: 500 }}>
                {r.phase}
              </div>
              <div className="text-[12px]" style={{ color: "var(--muted)" }}>
                {new Date(r.date).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
            </div>
            <div className="text-[13px] mt-1" style={{ color: "var(--muted)" }}>
              {r.actions}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

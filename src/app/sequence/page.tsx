import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SEQUENCE, SPACING_RULES } from "@/lib/sequence-rules";
import type { Item } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SequencePage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("items")
    .select("id, name, seed_id, status, brand, dose")
    .eq("status", "active");
  const items = (data ?? []) as Item[];

  function matchItems(match?: {
    seedIds?: string[];
    nameIncludes?: string[];
  }) {
    if (!match) return [];
    return items.filter((i) => {
      if (match.seedIds?.includes(i.seed_id ?? "")) return true;
      if (
        match.nameIncludes?.some((n) =>
          i.name.toLowerCase().includes(n.toLowerCase()),
        )
      )
        return true;
      return false;
    });
  }

  return (
    <div className="pb-24">
      <header className="mb-6">
        <h1 className="text-[32px] leading-tight" style={{ fontWeight: 600, letterSpacing: "-0.02em" }}>
          Optimal sequence
        </h1>
        <div className="text-[13px] mt-1" style={{ color: "var(--muted)" }}>
          Research-backed daily order. Items in your stack are linked.
        </div>
      </header>

      {SEQUENCE.map((window) => (
        <section key={window.window} className="mb-7">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-[16px]" style={{ fontWeight: 500 }}>
              {window.label}
            </h2>
            {window.time && (
              <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                {window.time}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {window.steps.map((step, idx) => {
              const matched = matchItems(step.matches);
              return (
                <div
                  key={idx}
                  className="border-hair rounded-xl p-3"
                  style={{
                    background: matched.length
                      ? "var(--background)"
                      : "var(--surface-alt)",
                    opacity: step.matches && matched.length === 0 ? 0.6 : 1,
                  }}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className="text-[12px] shrink-0 w-5 text-center"
                      style={{ color: "var(--muted)", fontWeight: 500 }}
                    >
                      {idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div
                        className="text-[14px] leading-snug"
                        style={{ fontWeight: 500 }}
                      >
                        {step.title}
                      </div>
                      <div
                        className="text-[13px] leading-relaxed mt-1"
                        style={{ color: "var(--muted)" }}
                      >
                        {step.detail}
                      </div>
                      {step.why && (
                        <div
                          className="text-[12px] mt-1"
                          style={{ color: "var(--muted)" }}
                        >
                          <span style={{ fontStyle: "italic" }}>Why:</span> {step.why}
                        </div>
                      )}
                      {step.source && (
                        <div
                          className="text-[11px] mt-1"
                          style={{ color: "var(--muted)" }}
                        >
                          {step.source}
                        </div>
                      )}
                      {matched.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {matched.map((item) => (
                            <Link
                              key={item.id}
                              href={`/items/${item.id}`}
                              className="text-[11px] px-2 py-0.5 rounded-full"
                              style={{
                                background: "var(--surface-alt)",
                                color: "var(--foreground)",
                                fontWeight: 500,
                              }}
                            >
                              {item.name}
                              {item.dose ? ` · ${item.dose}` : ""}
                            </Link>
                          ))}
                        </div>
                      )}
                      {step.matches && matched.length === 0 && (
                        <div
                          className="text-[10px] mt-1"
                          style={{ color: "var(--muted)", fontStyle: "italic" }}
                        >
                          Not in your stack
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <section className="mb-6">
        <h2 className="text-[16px] mb-3" style={{ fontWeight: 500 }}>
          Spacing + interaction rules
        </h2>
        <div className="flex flex-col gap-2">
          {SPACING_RULES.map((r, i) => (
            <div key={i} className="border-hair rounded-xl p-3">
              <div className="text-[13px]" style={{ fontWeight: 500 }}>
                {r.title}
              </div>
              <div
                className="text-[12px] mt-1 leading-relaxed"
                style={{ color: "var(--muted)" }}
              >
                {r.detail}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-[16px] mb-3" style={{ fontWeight: 500 }}>
          Food-order rule (for every meal)
        </h2>
        <div className="border-hair rounded-xl p-4">
          <ol className="flex flex-col gap-2 text-[13px] leading-relaxed">
            <li>
              <span style={{ fontWeight: 500 }}>1. Vegetables / fiber first.</span> Fills the stomach, slows glucose absorption.
            </li>
            <li>
              <span style={{ fontWeight: 500 }}>2. Protein + fat second.</span> Triggers satiety hormones (CCK, leptin).
            </li>
            <li>
              <span style={{ fontWeight: 500 }}>3. Starch / carbs last.</span> By the time you reach them, glucose curve is already blunted ~30–50%.
            </li>
          </ol>
          <div
            className="text-[11px] mt-3"
            style={{ color: "var(--muted)" }}
          >
            Source: Shukla 2017 (Diabetes Care) — same meal, food-order alone changes post-prandial glucose AUC.
          </div>
        </div>
      </section>
    </div>
  );
}

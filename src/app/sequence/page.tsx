import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SEQUENCE, SPACING_RULES } from "@/lib/sequence-rules";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/Section";
import Icon from "@/components/Icon";
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
      <PageHeader
        title="Daily order"
        back="/you"
        backLabel="You"
        subtitle="A research-informed order for your day. Anything already in your stack is linked."
      />

      {SEQUENCE.map((window) => (
        <section key={window.window}>
          <SectionHeader
            title={window.label}
            action={
              window.time ? (
                <span className="shrink-0 text-caption text-[var(--muted)] tabular-nums">
                  {window.time}
                </span>
              ) : undefined
            }
          />
          <div className="flex flex-col gap-2">
            {window.steps.map((step, idx) => {
              const matched = matchItems(step.matches);
              const missing = !!step.matches && matched.length === 0;
              return (
                <Card
                  key={idx}
                  padding="md"
                  variant={missing ? "inset" : "default"}
                >
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--surface-alt)] text-caption font-semibold tabular-nums text-[var(--foreground-soft)]"
                    >
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div
                        className={`text-callout font-semibold ${missing ? "text-[var(--foreground-soft)]" : ""}`}
                      >
                        {step.title}
                      </div>
                      <p className="mt-1 text-footnote leading-relaxed text-[var(--muted)]">
                        {step.detail}
                      </p>
                      {step.why && (
                        <p className="mt-1.5 text-footnote text-[var(--muted)]">
                          <span className="font-medium text-[var(--foreground-soft)]">
                            Why:
                          </span>{" "}
                          {step.why}
                        </p>
                      )}
                      {step.source && (
                        <p className="mt-1.5 text-caption text-[var(--muted)]">
                          {step.source}
                        </p>
                      )}
                      {matched.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {matched.map((item) => (
                            <Link
                              key={item.id}
                              href={`/items/${item.id}`}
                              className="relative inline-flex h-8 items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-alt)] px-3 text-caption font-medium text-[var(--foreground)] before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-[''] active:scale-95"
                            >
                              {item.name}
                              {item.dose ? (
                                <span className="text-[var(--muted)]">
                                  · {item.dose}
                                </span>
                              ) : null}
                              <Icon
                                name="chevron-right"
                                size={12}
                                strokeWidth={2}
                                className="text-[var(--muted)]"
                              />
                            </Link>
                          ))}
                        </div>
                      )}
                      {missing && (
                        <p className="mt-2 text-caption text-[var(--muted)]">
                          Not in your stack
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      ))}

      <SectionHeader title="Spacing and pairing" />
      <div className="flex flex-col gap-2">
        {SPACING_RULES.map((r, i) => (
          <Card key={i} padding="md">
            <div className="text-callout font-semibold">{r.title}</div>
            <p className="mt-1 text-footnote leading-relaxed text-[var(--muted)]">
              {r.detail}
            </p>
          </Card>
        ))}
      </div>

      <SectionHeader title="Eating order, every meal" />
      <Card padding="md">
        <ol className="flex flex-col gap-3 text-callout leading-relaxed">
          <li className="flex gap-3">
            <span className="w-4 shrink-0 font-semibold tabular-nums text-[var(--muted)]">
              1
            </span>
            <span>
              <span className="font-semibold">Vegetables and fiber first.</span>{" "}
              <span className="text-[var(--foreground-soft)]">
                They fill you up and slow down how fast sugar hits your blood.
              </span>
            </span>
          </li>
          <li className="flex gap-3">
            <span className="w-4 shrink-0 font-semibold tabular-nums text-[var(--muted)]">
              2
            </span>
            <span>
              <span className="font-semibold">Protein and fat next.</span>{" "}
              <span className="text-[var(--foreground-soft)]">
                They help you feel full sooner.
              </span>
            </span>
          </li>
          <li className="flex gap-3">
            <span className="w-4 shrink-0 font-semibold tabular-nums text-[var(--muted)]">
              3
            </span>
            <span>
              <span className="font-semibold">Starches and carbs last.</span>{" "}
              <span className="text-[var(--foreground-soft)]">
                By then, the blood-sugar spike from the same meal is noticeably
                smaller.
              </span>
            </span>
          </li>
        </ol>
        <p className="mt-4 text-caption text-[var(--muted)]">
          Source: Shukla et al., Diabetes Care (2017).
        </p>
      </Card>

      <p className="mt-6 text-caption text-[var(--muted)]">
        General information, not medical advice. Check with your doctor or
        pharmacist about timing for anything you take.
      </p>
    </div>
  );
}

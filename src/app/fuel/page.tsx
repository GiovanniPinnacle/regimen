"use client";

// /fuel — diet/intake hub. Replaces food items as a checklist with a
// "log what you ate" model. Three zones:
//   1. Today's intake — water + macros progress + meals logged today
//   2. Quick log — voice / photo / text shortcut to the universal
//      capture flow, plus frequent-meal chips for one-tap re-logs
//   3. Foods I aim to eat — items the user has saved as targets,
//      each with a one-tap "Log this" button

import { useEffect, useState } from "react";
import Link from "next/link";
import IntakeTracker from "@/components/IntakeTracker";
import Icon from "@/components/Icon";
import AskCoachButton from "@/components/AskCoachButton";
import { createClient } from "@/lib/supabase/client";
import { calcMacros, type MacroTargets } from "@/lib/macros";
import { POSTOP_DATE_ZERO } from "@/lib/constants";
import { showToast } from "@/lib/toast";
import type { Item } from "@/lib/types";

type FrequentMeal = { content: string; count: number };

export default function FuelPage() {
  const [macros, setMacros] = useState<MacroTargets | null>(null);
  const [foods, setFoods] = useState<Item[]>([]);
  const [frequentMeals, setFrequentMeals] = useState<FrequentMeal[]>([]);
  const [logging, setLogging] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const client = createClient();
      const [profileRes, foodsRes, mealsRes] = await Promise.all([
        client
          .from("profiles")
          .select(
            "weight_kg, height_cm, age, biological_sex, activity_level, body_goal, meals_per_day, postop_date",
          )
          .maybeSingle(),
        client
          .from("items")
          .select("*")
          .eq("item_type", "food")
          .in("status", ["active", "queued"])
          .order("name"),
        fetch("/api/intake/frequent", { credentials: "include" }).then((r) =>
          r.ok ? r.json() : { meals: [] },
        ),
      ]);
      if (!alive) return;

      const profile = profileRes.data;
      if (
        profile?.weight_kg &&
        profile.height_cm &&
        profile.age &&
        profile.biological_sex
      ) {
        const postOpDate = profile.postop_date ?? POSTOP_DATE_ZERO;
        const postOp =
          new Date(postOpDate).getTime() > Date.now() - 180 * 86400000;
        setMacros(
          calcMacros({
            weight_kg: profile.weight_kg,
            height_cm: profile.height_cm,
            age: profile.age,
            biological_sex: profile.biological_sex,
            activity_level: profile.activity_level ?? "moderate",
            body_goal: profile.body_goal ?? "maintain",
            meals_per_day: profile.meals_per_day ?? 3,
            post_op: postOp,
          }),
        );
      }
      setFoods((foodsRes.data ?? []) as Item[]);
      const mealsJson = (mealsRes ?? {}) as {
        meals?: { content: string; count?: number }[];
      };
      setFrequentMeals(
        (mealsJson.meals ?? []).slice(0, 6).map((m) => ({
          content: m.content,
          count: m.count ?? 1,
        })),
      );
    })();
    return () => {
      alive = false;
    };
  }, []);

  /** One-tap meal log — uses /api/intake with analyze=true so Claude
   *  infers macros from the meal description. Toast immediately,
   *  IntakeTracker re-fetches via items-changed. */
  async function quickLog(content: string) {
    if (logging) return;
    setLogging(content);
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          kind: "meal",
          content,
          analyze: true,
        }),
      });
      if (!res.ok) throw new Error("Couldn't log");
      showToast(`Logged: ${content}`, { tone: "success" });
      window.dispatchEvent(new CustomEvent("regimen:items-changed"));
    } catch (e) {
      showToast((e as Error).message, { tone: "error" });
    } finally {
      setLogging(null);
    }
  }

  return (
    <div className="pb-24">
      <header className="mb-5 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1
            className="text-[32px] leading-tight"
            style={{ fontWeight: 600, letterSpacing: "-0.02em" }}
          >
            Fuel
          </h1>
          <p
            className="text-[12.5px] mt-1 leading-relaxed"
            style={{ color: "var(--muted)" }}
          >
            What went in today — log in 2 seconds, Coach handles macros.
          </p>
        </div>
        <AskCoachButton
          prompt="Look at what I've eaten the last 3 days, my macro targets, and my goals. What should I eat today? Suggest 2-3 specific meals that fit. If anything looks off in my recent intake (low protein, missing micronutrient, blood sugar pattern from Stelo), call it out and emit a one-tap proposal in <<<PROPOSAL ... PROPOSAL>>> format with action: add."
          send
          label="What to eat?"
        />
      </header>

      {/* Today's intake — water, macros, meals logged. Same component
          the old /today page was using, just on its own tab now. */}
      <IntakeTracker
        targets={
          macros
            ? {
                calories: macros.calories,
                protein_g: macros.protein_g,
                water_oz: 84,
              }
            : { water_oz: 84 }
        }
      />

      {/* Frequent meals — one-tap re-log of meals you've logged before.
          Photo / Voice / Type flows live in the global "+" button —
          no need to duplicate them here. */}
      {frequentMeals.length > 0 && (
        <section className="mb-5">
          <h2
            className="text-[11px] uppercase tracking-wider mb-2 px-0.5"
            style={{
              color: "var(--muted)",
              fontWeight: 700,
              letterSpacing: "0.08em",
            }}
          >
            Frequent meals · 1-tap log
          </h2>
          <div className="flex gap-1.5 flex-wrap">
            {frequentMeals.map((m) => (
              <button
                key={m.content}
                onClick={() => quickLog(m.content)}
                disabled={logging === m.content}
                className="text-[12.5px] px-3 py-1.5 rounded-full"
                style={{
                  background: "var(--surface-alt)",
                  color: "var(--foreground)",
                  border: "1px solid var(--border)",
                  fontWeight: 600,
                  minHeight: 32,
                  opacity: logging === m.content ? 0.5 : 1,
                }}
              >
                {logging === m.content ? "…" : `↻ ${m.content}`}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Foods I aim to eat — the user's saved food items as a
          curated list, NOT a daily checklist. Each row has a one-tap
          "Log this" so the user can re-log a regular without typing. */}
      {foods.length > 0 && (
        <section className="mb-5">
          <div className="flex items-baseline justify-between mb-2 px-0.5">
            <h2
              className="text-[11px] uppercase tracking-wider"
              style={{
                color: "var(--muted)",
                fontWeight: 700,
                letterSpacing: "0.08em",
              }}
            >
              Foods I aim to eat · {foods.length}
            </h2>
            <Link
              href="/recipes"
              className="text-[11px]"
              style={{ color: "var(--accent)" }}
            >
              Recipes →
            </Link>
          </div>
          <div className="flex flex-col gap-1.5">
            {foods.map((f) => (
              <div
                key={f.id}
                className="rounded-xl card-glass px-3 py-2.5 flex items-center gap-2.5"
              >
                <Link
                  href={`/items/${f.id}`}
                  className="flex-1 min-w-0"
                >
                  <div
                    className="text-[14px] leading-snug truncate"
                    style={{ fontWeight: 600 }}
                  >
                    {f.name}
                  </div>
                  {f.brand && (
                    <div
                      className="text-[11.5px] mt-0.5 truncate"
                      style={{ color: "var(--muted)" }}
                    >
                      {f.brand}
                    </div>
                  )}
                </Link>
                <button
                  onClick={() => quickLog(f.name)}
                  disabled={logging === f.name}
                  className="shrink-0 text-[12px] px-3 py-1.5 rounded-lg"
                  style={{
                    background: "var(--olive)",
                    color: "#FBFAF6",
                    fontWeight: 700,
                    minHeight: 32,
                    opacity: logging === f.name ? 0.5 : 1,
                  }}
                >
                  {logging === f.name ? "…" : "Log"}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

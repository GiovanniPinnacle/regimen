"use client";

// /audit — fast-paced "have / need / skip" triage of every item you'd
// actually buy. Tap once per item, items disappear, counters tick up.
// One-tap-per-item is the design goal. A "Have Coach sort the rest"
// row lets users offload the work entirely.

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Item, ItemType } from "@/lib/types";
import { ITEM_TYPE_LABELS } from "@/lib/constants";
import Icon from "@/components/Icon";
import ItemTypeIcon from "@/components/ItemTypeIcon";
import StackWarningsBanner from "@/components/StackWarningsBanner";
import EmptyGlyph from "@/components/EmptyGlyph";
import { SkeletonCard } from "@/components/Skeleton";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button, { ButtonLink } from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import ListRow, { ListGroup } from "@/components/ui/ListRow";
import { SectionHeader } from "@/components/ui/Section";

// Types that make sense to audit — things you BUY (not foods, not practices).
const AUDITABLE_TYPES: ItemType[] = [
  "supplement",
  "topical",
  "device",
  "gear",
  "test",
];

const TYPE_ORDER: ItemType[] = [
  "supplement",
  "topical",
  "device",
  "gear",
  "test",
];

export default function AuditPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [haveCount, setHaveCount] = useState(0);
  const [needCount, setNeedCount] = useState(0);
  const [skipCount, setSkipCount] = useState(0);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    function onChange() {
      setReloadKey((k) => k + 1);
    }
    window.addEventListener("regimen:items-changed", onChange);
    return () =>
      window.removeEventListener("regimen:items-changed", onChange);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const supabase = createClient();
      // Project only fields the audit UI renders (id/name/brand/
      // dose/item_type/status/review_trigger/owned/purchase_state).
      // Audit always pages through the full set so cap at 500.
      const { data } = await supabase
        .from("items")
        .select(
          "id, name, brand, dose, item_type, status, review_trigger, owned, purchase_state",
        )
        .in("status", ["active", "queued"])
        .in("item_type", AUDITABLE_TYPES)
        .is("owned", null)
        .order("item_type")
        .order("name")
        .limit(500);
      if (!alive) return;
      setItems((data ?? []) as Item[]);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  async function mark(item: Item, choice: "have" | "need" | "skip") {
    setSaving((s) => ({ ...s, [item.id]: true }));
    const supabase = createClient();
    const updates: Record<string, unknown> = {};
    if (choice === "have") {
      updates.owned = true;
      updates.purchase_state = "using";
      if (item.status === "queued") updates.status = "active";
    } else if (choice === "need") {
      updates.owned = false;
      updates.purchase_state = "needed";
    } else if (choice === "skip") {
      updates.status = "retired";
      updates.owned = null;
      updates.purchase_state = null;
    }
    await supabase.from("items").update(updates).eq("id", item.id);
    setHaveCount((c) => (choice === "have" ? c + 1 : c));
    setNeedCount((c) => (choice === "need" ? c + 1 : c));
    setSkipCount((c) => (choice === "skip" ? c + 1 : c));
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    setSaving((s) => ({ ...s, [item.id]: false }));
  }

  function fireCoachAudit() {
    const prompt =
      `Run a bulk audit of items I haven't triaged yet. For each one, decide ` +
      `whether I likely already Have it, Need to order it, or should Skip it ` +
      `entirely — based on my goals, banned items, recent reactions, and what ` +
      `else is in my stack. Only surface the calls you're confident about. For ` +
      `each, emit a one-tap proposal in <<<PROPOSAL ... PROPOSAL>>> format with ` +
      `action: adjust and an "owned" hint of true/false in extra (true means I ` +
      `have it, false means I need to order it).`;
    window.dispatchEvent(
      new CustomEvent("regimen:ask", {
        detail: { text: prompt, send: true },
      }),
    );
  }

  const grouped = useMemo(() => {
    const map: Record<string, Item[]> = {};
    for (const i of items) {
      if (!map[i.item_type]) map[i.item_type] = [];
      map[i.item_type].push(i);
    }
    return map;
  }, [items]);


  const remaining = items.length;
  const sessionTotal = haveCount + needCount + skipCount;

  const header = (
    <PageHeader
      title="Stock check"
      back="/you"
      backLabel="You"
      subtitle="One tap per item: have it, need it, or skip it. Items clear as you go."
    />
  );

  if (loading) {
    return (
      <div className="pb-24" aria-busy>
        {header}
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((k) => (
            <SkeletonCard key={k} height={132} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24">
      {header}

      {/* Progress */}
      <Card padding="md">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-title-2 font-bold tabular-nums">
                {remaining}
              </span>
              <span className="text-footnote text-[var(--muted)]">left</span>
            </div>
            {sessionTotal > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {haveCount > 0 && (
                  <Chip size="sm" tone="success" icon="check">
                    {haveCount} have
                  </Chip>
                )}
                {needCount > 0 && (
                  <Chip size="sm" icon="shopping-bag">
                    {needCount} need
                  </Chip>
                )}
                {skipCount > 0 && <Chip size="sm">{skipCount} skipped</Chip>}
              </div>
            )}
          </div>
          {needCount > 0 && (
            <ButtonLink
              href="/purchases"
              variant="secondary"
              iconRight="chevron-right"
            >
              Shopping list
            </ButtonLink>
          )}
        </div>
      </Card>

      {remaining > 3 && (
        <ListGroup className="mt-3">
          <ListRow
            icon="sparkle"
            iconTone="coach"
            title="Have Coach sort the rest"
            subtitle="Coach suggests have, need, or skip for each item"
            onClick={fireCoachAudit}
            chevron
          />
        </ListGroup>
      )}

      {/* Cumulative ingredient safety check — surfaces here too because
          /audit is where the user is actively triaging the stack. If
          anything's over UL, this is the moment to act. Persistent here
          (no dismiss) since this is exactly the surface for action. */}
      <div className="mt-3">
        <StackWarningsBanner surface="audit" persistent />
      </div>

      {TYPE_ORDER.map((type) => {
        const list = grouped[type];
        if (!list || list.length === 0) return null;
        return (
          <section key={type}>
            <SectionHeader
              title={`${ITEM_TYPE_LABELS[type]}s`}
              action={
                <span className="shrink-0 text-footnote tabular-nums text-[var(--muted)]">
                  {list.length}
                </span>
              }
            />
            <div className="flex flex-col gap-2">
              {list.map((item) => (
                <AuditRow
                  key={item.id}
                  item={item}
                  busy={saving[item.id] ?? false}
                  onChoice={mark}
                />
              ))}
            </div>
          </section>
        );
      })}

      {remaining === 0 && (
        <Card padding="xl" className="mt-6 flex flex-col items-center text-center">
          {sessionTotal > 0 ? (
            <span className="flex h-16 w-16 items-center justify-center rounded-[18px] bg-[var(--success-tint)] text-[var(--success)]">
              <Icon name="check-circle" size={30} strokeWidth={1.8} />
            </span>
          ) : (
            <EmptyGlyph icon="check-circle" tone="muted" size={64} />
          )}
          <div className="mt-4 text-title-3">
            {sessionTotal > 0 ? "All caught up" : "Nothing to check"}
          </div>
          <p className="mt-1 text-callout text-[var(--muted)]">
            {sessionTotal > 0
              ? `You sorted ${sessionTotal} ${sessionTotal === 1 ? "item" : "items"} this session.`
              : "Everything in your stack is already sorted."}
          </p>
          {needCount > 0 && (
            <ButtonLink href="/purchases" className="mt-5" iconRight="chevron-right">
              See shopping list
            </ButtonLink>
          )}
        </Card>
      )}
    </div>
  );
}

function AuditRow({
  item,
  busy,
  onChoice,
}: {
  item: Item;
  busy: boolean;
  onChoice: (item: Item, choice: "have" | "need" | "skip") => void;
}) {
  return (
    <Card
      padding="md"
      className={`transition-opacity duration-150 ${busy ? "opacity-50" : ""}`}
    >
      <div className="mb-3 flex items-start gap-3">
        <ItemTypeIcon type={item.item_type} size={32} />
        <div className="min-w-0 flex-1">
          <div className="text-callout font-semibold leading-snug">
            {item.name}
          </div>
          {(item.brand || item.dose) && (
            <div className="mt-0.5 truncate text-caption text-[var(--muted)]">
              {[item.brand, item.dose].filter(Boolean).join(" · ")}
            </div>
          )}
          {item.status === "queued" && item.review_trigger && (
            <div className="mt-0.5 text-caption text-[var(--muted)]">
              Planned: {item.review_trigger}
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Button
          variant="secondary"
          icon="check"
          disabled={busy}
          onClick={() => onChoice(item, "have")}
        >
          Have
        </Button>
        <Button
          variant="secondary"
          icon="shopping-bag"
          disabled={busy}
          onClick={() => onChoice(item, "need")}
        >
          Need
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => onChoice(item, "skip")}
        >
          Skip
        </Button>
      </div>
    </Card>
  );
}

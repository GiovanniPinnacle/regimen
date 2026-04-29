// /strategy/revenue — owner-facing affiliate dashboard.
//
// Aggregates clicks + conversions from the affiliate_clicks and
// affiliate_conversions tables. Each authenticated user sees their own
// "items I've clicked" history. The owner (matched by ADMIN_EMAILS env)
// also sees app-wide totals + top items + revenue projection.

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  AFFILIATE_CONFIGS,
  estimateCommissionCents,
  type AffiliateNetwork,
} from "@/lib/affiliates";

export const dynamic = "force-dynamic";

type ClickRow = {
  id: string;
  item_id: string | null;
  item_name: string | null;
  affiliate_network: string | null;
  vendor: string | null;
  source: string | null;
  clicked_at: string;
};

function fmtUSD(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function isOwner(email: string | null | undefined): boolean {
  if (!email) return false;
  const env = process.env.ADMIN_EMAILS ?? "";
  const list = env
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

export default async function RevenuePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <div className="pb-24">
        <header className="mb-6">
          <h1
            className="text-[28px]"
            style={{ fontWeight: 600, letterSpacing: "-0.02em" }}
          >
            Revenue
          </h1>
        </header>
        <div className="rounded-2xl card-glass p-6 text-center">
          <Link
            href="/signin"
            className="text-[14px]"
            style={{ color: "var(--accent)", fontWeight: 600 }}
          >
            Sign in to view
          </Link>
        </div>
      </div>
    );
  }

  const owner = isOwner(user.email);
  const since30 = new Date(Date.now() - 30 * 86400000).toISOString();

  const userClient = supabase;
  const sourceClient = owner ? createAdminClient() : userClient;

  // Per-user history (always)
  const { data: myClicks } = await userClient
    .from("affiliate_clicks")
    .select("*")
    .gte("clicked_at", since30)
    .order("clicked_at", { ascending: false })
    .limit(40);

  // App-wide totals (owner only)
  let appWide: ClickRow[] = [];
  if (owner) {
    const { data } = await sourceClient
      .from("affiliate_clicks")
      .select("*")
      .gte("clicked_at", since30);
    appWide = (data ?? []) as ClickRow[];
  }

  const myList = (myClicks ?? []) as ClickRow[];

  return (
    <div className="pb-24">
      <header className="mb-6">
        <div className="mb-2">
          <Link
            href="/strategy"
            className="text-[12px]"
            style={{ color: "var(--muted)" }}
          >
            ← Strategy
          </Link>
        </div>
        <h1
          className="text-[32px] leading-tight"
          style={{ fontWeight: 600, letterSpacing: "-0.02em" }}
        >
          Revenue
        </h1>
        <p
          className="text-[13px] mt-1 leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          {owner
            ? "App-wide affiliate clicks + revenue projection (last 30 days)."
            : "Items you've ordered through Regimen (last 30 days)."}
        </p>
      </header>

      {owner && <OwnerSummary clicks={appWide} />}

      <section className="mb-7">
        <h2
          className="text-[11px] uppercase tracking-wider mb-2.5"
          style={{
            color: "var(--muted)",
            fontWeight: 700,
            letterSpacing: "0.08em",
          }}
        >
          {owner ? "App-wide recent clicks" : "Your recent clicks"}
        </h2>
        {(owner ? appWide : myList).length === 0 ? (
          <div
            className="rounded-2xl card-glass p-6 text-center text-[13px]"
            style={{ color: "var(--muted)" }}
          >
            No clicks yet in the last 30 days.
          </div>
        ) : (
          <div className="rounded-2xl card-glass overflow-hidden">
            {(owner ? appWide : myList).slice(0, 30).map((c, i) => (
              <div
                key={c.id}
                className="px-4 py-3 flex items-baseline justify-between gap-3"
                style={{
                  borderTop: i > 0 ? "1px solid var(--border)" : undefined,
                }}
              >
                <div className="min-w-0 flex-1">
                  <div
                    className="text-[13.5px] truncate"
                    style={{ fontWeight: 600 }}
                  >
                    {c.item_name ?? "(unnamed item)"}
                  </div>
                  <div
                    className="text-[11px] mt-0.5 flex gap-2"
                    style={{ color: "var(--muted)" }}
                  >
                    {c.vendor && <span>{c.vendor}</span>}
                    {c.affiliate_network && (
                      <span>· {c.affiliate_network}</span>
                    )}
                    {c.source && <span>· {c.source}</span>}
                  </div>
                </div>
                <div
                  className="text-[11px] tabular-nums shrink-0"
                  style={{ color: "var(--muted)" }}
                >
                  {new Date(c.clicked_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {!owner && (
        <div
          className="text-[11px] leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          Regimen earns a commission on items you order through tracked
          vendor links. Recommendations are picked first on health merit —
          affiliates are only attached after Coach approves the item.
        </div>
      )}
    </div>
  );
}

function OwnerSummary({ clicks }: { clicks: ClickRow[] }) {
  const totalClicks = clicks.length;
  const uniqueUsers = new Set(
    clicks.map((c) => (c as { user_id?: string }).user_id).filter(Boolean),
  ).size;

  // Network breakdown
  const byNetwork: Record<string, { clicks: number; commission: number }> = {};
  for (const c of clicks) {
    const n = c.affiliate_network ?? "unknown";
    if (!byNetwork[n]) byNetwork[n] = { clicks: 0, commission: 0 };
    byNetwork[n].clicks++;
    if (n in AFFILIATE_CONFIGS) {
      // Assume avg $30 sale per click * 5% conversion rate as a baseline
      // projection. Real data replaces this once conversions are tracked.
      const projected = estimateCommissionCents(3000, n as AffiliateNetwork);
      byNetwork[n].commission += Math.round(projected * 0.05);
    }
  }

  const totalProjected = Object.values(byNetwork).reduce(
    (s, n) => s + n.commission,
    0,
  );

  // Top items
  const itemAgg = new Map<
    string,
    { name: string; clicks: number; vendor: string | null }
  >();
  for (const c of clicks) {
    if (!c.item_id || !c.item_name) continue;
    const cur = itemAgg.get(c.item_id) ?? {
      name: c.item_name,
      clicks: 0,
      vendor: c.vendor,
    };
    cur.clicks++;
    itemAgg.set(c.item_id, cur);
  }
  const topItems = Array.from(itemAgg.entries())
    .sort((a, b) => b[1].clicks - a[1].clicks)
    .slice(0, 8);

  return (
    <>
      <section
        className="rounded-2xl p-5 mb-5"
        style={{
          background:
            "linear-gradient(135deg, var(--premium) 0%, var(--premium-deep) 100%)",
          color: "#FBFAF6",
          boxShadow: "0 12px 32px var(--premium-glow)",
        }}
      >
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Clicks · 30d" value={String(totalClicks)} />
          <Stat label="Unique users" value={String(uniqueUsers)} />
          <Stat
            label="Projected"
            value={fmtUSD(totalProjected)}
            small
          />
        </div>
        <div
          className="text-[10.5px] mt-3 leading-relaxed"
          style={{ opacity: 0.82 }}
        >
          Projection = clicks × avg-cart × commission × 5% conversion baseline.
          Replaced with real numbers once Stripe webhooks / direct
          conversion tracking is wired.
        </div>
      </section>

      {Object.keys(byNetwork).length > 0 && (
        <section className="mb-7">
          <h2
            className="text-[11px] uppercase tracking-wider mb-2.5"
            style={{
              color: "var(--muted)",
              fontWeight: 700,
              letterSpacing: "0.08em",
            }}
          >
            By network
          </h2>
          <div className="rounded-2xl card-glass overflow-hidden">
            {Object.entries(byNetwork)
              .sort((a, b) => b[1].clicks - a[1].clicks)
              .map(([n, v], i) => (
                <div
                  key={n}
                  className="px-4 py-3 flex items-center justify-between"
                  style={{
                    borderTop: i > 0 ? "1px solid var(--border)" : undefined,
                  }}
                >
                  <div>
                    <div
                      className="text-[13.5px] capitalize"
                      style={{ fontWeight: 600 }}
                    >
                      {n}
                    </div>
                    <div
                      className="text-[11px]"
                      style={{ color: "var(--muted)" }}
                    >
                      {v.clicks} {v.clicks === 1 ? "click" : "clicks"}
                    </div>
                  </div>
                  <div
                    className="text-[14px] tabular-nums"
                    style={{ color: "var(--premium)", fontWeight: 700 }}
                  >
                    ~{fmtUSD(v.commission)}
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}

      {topItems.length > 0 && (
        <section className="mb-7">
          <h2
            className="text-[11px] uppercase tracking-wider mb-2.5"
            style={{
              color: "var(--muted)",
              fontWeight: 700,
              letterSpacing: "0.08em",
            }}
          >
            Top items
          </h2>
          <div className="rounded-2xl card-glass overflow-hidden">
            {topItems.map(([id, v], i) => (
              <Link
                key={id}
                href={`/items/${id}`}
                className="block px-4 py-3 flex items-center justify-between"
                style={{
                  borderTop: i > 0 ? "1px solid var(--border)" : undefined,
                }}
              >
                <div className="min-w-0 flex-1">
                  <div
                    className="text-[13.5px] truncate"
                    style={{ fontWeight: 600 }}
                  >
                    {v.name}
                  </div>
                  {v.vendor && (
                    <div
                      className="text-[11px]"
                      style={{ color: "var(--muted)" }}
                    >
                      {v.vendor}
                    </div>
                  )}
                </div>
                <div
                  className="text-[13px] tabular-nums shrink-0 ml-2"
                  style={{ color: "var(--muted)" }}
                >
                  {v.clicks} {v.clicks === 1 ? "click" : "clicks"}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function Stat({
  label,
  value,
  small,
}: {
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div>
      <div
        className="text-[9.5px] uppercase tracking-wider"
        style={{
          opacity: 0.85,
          fontWeight: 700,
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </div>
      <div
        className={
          small
            ? "text-[18px] tabular-nums leading-tight mt-1"
            : "text-[22px] tabular-nums leading-tight mt-1"
        }
        style={{ fontWeight: 700, letterSpacing: "-0.02em" }}
      >
        {value}
      </div>
    </div>
  );
}

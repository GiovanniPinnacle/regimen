// /strategy/revenue — owner-facing affiliate dashboard.
//
// Aggregates clicks + conversions from the affiliate_clicks and
// affiliate_conversions tables. Each authenticated user sees their own
// "items I've clicked" history. The owner (matched by ADMIN_EMAILS env)
// also sees app-wide totals + top items + revenue projection.

import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import ListRow, { ListGroup } from "@/components/ui/ListRow";
import { SectionHeader, Stat } from "@/components/ui/Section";
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

function getNow(): number {
  return Date.now();
}

export default async function RevenuePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <div className="pb-24">
        <PageHeader title="Revenue" back="/strategy" backLabel="Strategy" />
        <Card padding="xl" className="flex flex-col items-center text-center">
          <p className="text-callout text-[var(--muted)]">
            Sign in to see this page.
          </p>
          <ButtonLink href="/signin" className="mt-4">
            Sign in
          </ButtonLink>
        </Card>
      </div>
    );
  }

  const owner = isOwner(user.email);
  const since30 = new Date(getNow() - 30 * 86400000).toISOString();

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
  const recent = owner ? appWide : myList;

  return (
    <div className="pb-24">
      <PageHeader
        title="Revenue"
        back="/strategy"
        backLabel="Strategy"
        subtitle={
          owner
            ? "App-wide affiliate clicks and projected revenue, last 30 days."
            : "Items you've ordered through Regimen, last 30 days."
        }
      />

      {owner && <OwnerSummary clicks={appWide} />}

      <SectionHeader
        className={owner ? "" : "mt-0"}
        title={owner ? "Recent clicks, app-wide" : "Your recent clicks"}
      />
      {recent.length === 0 ? (
        <Card padding="lg" className="text-center">
          <p className="text-callout text-[var(--muted)]">
            No clicks in the last 30 days.
          </p>
        </Card>
      ) : (
        <ListGroup>
          {recent.slice(0, 30).map((c) => (
            <ListRow
              key={c.id}
              title={c.item_name ?? "Unnamed item"}
              subtitle={
                [c.vendor, c.affiliate_network, c.source]
                  .filter(Boolean)
                  .join(" · ") || undefined
              }
              trailing={new Date(c.clicked_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            />
          ))}
        </ListGroup>
      )}

      {!owner && (
        <p className="mt-6 text-caption leading-relaxed text-[var(--muted)]">
          Regimen earns a commission on items you order through tracked vendor
          links. Recommendations are chosen on health merit first; a store
          link is only attached after Coach approves the item.
        </p>
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
      <Card padding="lg">
        <div className="grid grid-cols-3 gap-3">
          <Stat size="sm" label="Clicks · 30d" value={totalClicks} />
          <Stat size="sm" label="Unique users" value={uniqueUsers} />
          <Stat
            size="sm"
            label="Projected"
            value={
              <span className="text-[var(--premium)]">
                {fmtUSD(totalProjected)}
              </span>
            }
          />
        </div>
        <p className="mt-4 text-caption leading-relaxed text-[var(--muted)]">
          Projection = clicks × average cart × commission × a 5% conversion
          baseline. Real numbers replace this once conversion tracking is
          wired up.
        </p>
      </Card>

      {Object.keys(byNetwork).length > 0 && (
        <>
          <SectionHeader title="By network" />
          <ListGroup>
            {Object.entries(byNetwork)
              .sort((a, b) => b[1].clicks - a[1].clicks)
              .map(([n, v]) => (
                <ListRow
                  key={n}
                  title={<span className="capitalize">{n}</span>}
                  subtitle={`${v.clicks} ${v.clicks === 1 ? "click" : "clicks"}`}
                  trailing={
                    <span className="text-callout font-semibold text-[var(--premium)]">
                      ~{fmtUSD(v.commission)}
                    </span>
                  }
                />
              ))}
          </ListGroup>
        </>
      )}

      {topItems.length > 0 && (
        <>
          <SectionHeader title="Top items" />
          <ListGroup>
            {topItems.map(([id, v]) => (
              <ListRow
                key={id}
                href={`/items/${id}`}
                title={v.name}
                subtitle={v.vendor ?? undefined}
                trailing={`${v.clicks} ${v.clicks === 1 ? "click" : "clicks"}`}
              />
            ))}
          </ListGroup>
        </>
      )}
    </>
  );
}

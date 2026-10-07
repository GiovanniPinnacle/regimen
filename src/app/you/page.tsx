// /you — the "You" tab. Settings-style hub that replaces /more: stack,
// shopping, labs, protocols, progress, Coach history, profile, settings,
// feedback, legal. Admin-only maintenance lives in its own group at the
// bottom and only renders for ADMIN_EMAILS.

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { addDaysISO, computeStreak, localDateISO } from "@/lib/series";
import PageHeader from "@/components/ui/PageHeader";
import ListRow, { ListGroup } from "@/components/ui/ListRow";
import { Stat } from "@/components/ui/Section";
import {
  AdminTools,
  FeedbackRow,
  NotificationsRow,
  OuraRow,
  SignOutRow,
} from "./YouClient";

export const dynamic = "force-dynamic";

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-7 mb-2 px-4 text-eyebrow uppercase text-[var(--muted)]">
      {children}
    </h2>
  );
}

export default async function YouPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const admin = isAdmin(user?.email);

  let displayName: string | null = null;
  let activeCount: number | null = null;
  let streak: number | null = null;

  if (user) {
    const [{ data: profile }, activeRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("display_name, timezone")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("items")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
    ]);
    displayName = (profile?.display_name as string | null) ?? null;
    activeCount = activeRes.error ? null : (activeRes.count ?? 0);

    // Streak anchored on the user's own calendar day (server is UTC).
    const tz = (profile?.timezone as string | null) ?? undefined;
    const today = localDateISO(new Date(), tz);
    const { data: logs, error: logErr } = await supabase
      .from("stack_log")
      .select("date, taken")
      .gte("date", addDaysISO(today, -120));
    if (!logErr) {
      streak = computeStreak(
        (logs ?? []) as { date: string; taken?: boolean | null }[],
        today,
      );
    }
  }

  const name =
    displayName?.trim() || user?.email?.split("@")[0] || "Your account";
  const initial = name.charAt(0).toUpperCase();

  return (
    <div>
      <PageHeader title="You" />

      {/* Identity + a couple of real numbers */}
      <section className="flex items-center gap-4 rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-4">
        <div
          aria-hidden
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--surface-alt)] text-title-2 text-[var(--foreground)]"
        >
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-title-3">{name}</div>
          {user?.email && displayName && (
            <div className="truncate text-footnote text-[var(--muted)]">
              {user.email}
            </div>
          )}
          <Link
            href="/about-me"
            className="mt-0.5 inline-flex min-h-[32px] items-center gap-0.5 text-footnote font-medium text-[var(--foreground-soft)]"
          >
            Edit profile
          </Link>
        </div>
      </section>

      {(activeCount != null || streak != null) && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          {activeCount != null && (
            <Link
              href="/stack"
              className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-4 active:scale-[0.99] transition-transform"
            >
              <Stat
                label="Active items"
                value={activeCount}
                size="sm"
                sub="in your stack"
              />
            </Link>
          )}
          {streak != null && (
            <Link
              href="/achievements"
              className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-4 active:scale-[0.99] transition-transform"
            >
              <Stat
                label="Current streak"
                value={streak}
                unit={streak === 1 ? "day" : "days"}
                size="sm"
                sub={streak > 0 ? "keep it going" : "log a dose to start"}
              />
            </Link>
          )}
        </div>
      )}

      <GroupLabel>My stack</GroupLabel>
      <ListGroup>
        <ListRow
          href="/stack"
          icon="list-ordered"
          title="My stack"
          subtitle="Active, queued, and parked"
        />
        <ListRow
          href="/items/new"
          icon="plus"
          title="Add an item"
          subtitle="Supplement, topical, food, or habit"
        />
        <ListRow
          href="/costs"
          icon="dollar"
          title="Costs"
          subtitle="Monthly spend and breakdown"
        />
        <ListRow
          href="/sequence"
          icon="clock"
          title="Daily order"
          subtitle="When to take what"
        />
      </ListGroup>

      <GroupLabel>Shopping</GroupLabel>
      <ListGroup>
        <ListRow
          href="/purchases"
          icon="shopping-bag"
          title="Shopping list"
          subtitle="Items you need to reorder"
        />
        <ListRow
          href="/wishlist"
          icon="star"
          title="Wishlist"
          subtitle="Things you're considering"
        />
        <ListRow
          href="/audit"
          icon="check-circle"
          title="Stock check"
          subtitle="What you have vs. what to order"
        />
      </ListGroup>

      <GroupLabel>Labs</GroupLabel>
      <ListGroup>
        <ListRow
          href="/tests"
          icon="test-tube"
          title="Bloodwork & tests"
          subtitle="Panels, results, and trends"
        />
        <ListRow
          href="/data"
          icon="download"
          title="Import data"
          subtitle="Lab PDFs and wearable exports"
        />
      </ListGroup>

      <GroupLabel>Protocols</GroupLabel>
      <ListGroup>
        <ListRow
          href="/protocols"
          icon="compass"
          title="Protocols"
          subtitle="Guided multi-week programs"
        />
      </ListGroup>

      <GroupLabel>Progress</GroupLabel>
      <ListGroup>
        <ListRow
          href="/recap"
          icon="calendar"
          title="Weekly recap"
          subtitle="Your last 7 days at a glance"
        />
        <ListRow
          href="/insights"
          icon="graph"
          title="Insights"
          subtitle="Patterns, trends, and what's working"
        />
        <ListRow
          href="/achievements"
          icon="award"
          title="Achievements"
          subtitle="Milestones you've unlocked"
        />
        <ListRow
          href="/reviews"
          icon="target"
          title="Check-ins"
          subtitle="Scheduled reviews and decisions"
        />
        <ListRow
          href="/changelog"
          icon="edit"
          title="Change log"
          subtitle="Every change to your routine"
        />
      </ListGroup>

      <GroupLabel>Tools</GroupLabel>
      <ListGroup>
        <ListRow
          href="/search"
          icon="search"
          title="Search"
          subtitle="Items, protocols, notes, recipes"
        />
        <ListRow
          href="/scan"
          icon="camera"
          title="Scan"
          subtitle="Photo of a meal or supplement label"
        />
        <ListRow
          href="/recipes"
          icon="book"
          title="Recipes"
          subtitle="Saved and Coach-generated meals"
        />
      </ListGroup>

      <GroupLabel>Coach</GroupLabel>
      <ListGroup>
        <ListRow
          href="/coach-history"
          icon="sparkle"
          iconTone="coach"
          title="Coach history"
          subtitle="Past conversations"
        />
      </ListGroup>

      <GroupLabel>Profile</GroupLabel>
      <ListGroup>
        <ListRow
          href="/about-me"
          icon="user"
          title="About me"
          subtitle="Goals and context Coach uses"
        />
        <ListRow
          href="/profile"
          icon="scale"
          title="Body & nutrition targets"
          subtitle="Weight, activity, macros"
        />
        <ListRow
          href="/hard-nos"
          icon="ban"
          title="Hard no's"
          subtitle="Things Coach should never suggest"
        />
      </ListGroup>

      <GroupLabel>Settings</GroupLabel>
      <ListGroup>
        <NotificationsRow />
        <OuraRow />
        <ListRow
          href="/account"
          icon="shield"
          title="Account & data"
          subtitle="Export or delete your data"
        />
      </ListGroup>

      <GroupLabel>Support</GroupLabel>
      <ListGroup>
        <FeedbackRow />
        <ListRow
          href="/privacy"
          icon="lock"
          title="Privacy policy"
        />
        <ListRow href="/terms" icon="file-text" title="Terms of service" />
      </ListGroup>

      {admin && (
        <>
          <GroupLabel>Admin</GroupLabel>
          <ListGroup>
            <ListRow
              href="/strategy"
              icon="compass"
              title="Strategy"
              subtitle="Vision, packs, revenue"
            />
            <ListRow
              href="/admin/catalog"
              icon="book"
              title="Catalog"
              subtitle="Browse and enrich catalog items"
            />
            <ListRow
              href="/admin/data-health"
              icon="shield"
              title="Data health"
              subtitle="Scan for invalid values and heal them"
            />
            <ListRow
              href="/dedupe"
              icon="trash"
              title="Clean up duplicates"
              subtitle="Merge same-named items"
            />
            <ListRow
              href="/welcome"
              icon="sparkle"
              title="Replay first-run reveal"
            />
          </ListGroup>
          <AdminTools />
        </>
      )}

      <div className="mt-7">
        <ListGroup>
          <SignOutRow />
        </ListGroup>
      </div>
    </div>
  );
}

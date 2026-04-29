// /coach-history — scroll-back archive of past Coach conversations.
//
// Reads from claude_conversations (one row per turn since the persist
// landing in /api/ask). Renders newest-first, day-grouped, with copy
// buttons on each turn. Read-only — Coach picks up new threads from
// the Coach FAB on /today.

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Icon from "@/components/Icon";
import CoachMarkdown from "@/components/CoachMarkdown";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  created_at: string;
  messages_json: {
    user?: unknown;
    assistant?: unknown;
  } | null;
};

function userTextFromJson(j: unknown): string {
  if (typeof j === "string") return j;
  if (Array.isArray(j)) {
    return (j as Array<{ type: string; text?: string }>)
      .filter((p) => p.type === "text" && p.text)
      .map((p) => p.text!)
      .join(" ");
  }
  return "";
}

export default async function CoachHistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <div className="py-12 text-center" style={{ color: "var(--muted)" }}>
        Sign in to see your Coach history.
      </div>
    );
  }
  const admin = createAdminClient();
  const { data } = await admin
    .from("claude_conversations")
    .select("id, created_at, messages_json")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(60);

  const rows = (data ?? []) as Row[];

  // Group by date (YYYY-MM-DD in user's locale-ish — we use the row's
  // ISO date prefix; close enough for a "Yesterday / Today" breakdown).
  type Group = { date: string; rows: Row[] };
  const groups: Group[] = [];
  for (const r of rows) {
    const d = r.created_at.slice(0, 10);
    const last = groups[groups.length - 1];
    if (last && last.date === d) last.rows.push(r);
    else groups.push({ date: d, rows: [r] });
  }

  return (
    <div className="pb-24">
      <header className="mb-6">
        <div className="mb-2">
          <Link
            href="/more"
            className="text-[12px] inline-flex items-center gap-1"
            style={{ color: "var(--muted)" }}
          >
            <Icon name="chevron-right" size={11} className="rotate-180" />
            More
          </Link>
        </div>
        <h1
          className="text-[32px] leading-tight"
          style={{ fontWeight: 600, letterSpacing: "-0.02em" }}
        >
          Coach history
        </h1>
        <p
          className="text-[13px] mt-1 leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          Past conversations, newest first. Coach references the most-recent
          turn automatically; older threads stay here for your reference.
        </p>
      </header>

      {rows.length === 0 ? (
        <div
          className="rounded-2xl card-glass p-8 text-center"
          style={{ color: "var(--muted)" }}
        >
          <div className="text-[14px]" style={{ fontWeight: 500 }}>
            No saved conversations yet.
          </div>
          <div className="text-[12px] mt-1.5">
            Open Coach from the floating button on /today and ask anything —
            this archive starts filling immediately.
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((g) => (
            <section key={g.date}>
              <h2
                className="text-[11px] uppercase tracking-wider mb-2.5 px-1"
                style={{
                  color: "var(--muted)",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                }}
              >
                {formatDateHeading(g.date)}
              </h2>
              <div className="flex flex-col gap-3">
                {g.rows.map((row) => {
                  const userText = userTextFromJson(row.messages_json?.user);
                  const asstText =
                    typeof row.messages_json?.assistant === "string"
                      ? (row.messages_json.assistant as string)
                      : "";
                  const time = new Date(row.created_at).toLocaleTimeString(
                    undefined,
                    { hour: "numeric", minute: "2-digit" },
                  );
                  return (
                    <article
                      key={row.id}
                      className="rounded-2xl card-glass p-4"
                    >
                      <div
                        className="text-[10px] uppercase tracking-wider mb-2"
                        style={{
                          color: "var(--muted)",
                          fontWeight: 600,
                          letterSpacing: "0.08em",
                        }}
                      >
                        {time}
                      </div>
                      {userText ? (
                        <div className="mb-3">
                          <div
                            className="text-[10px] uppercase tracking-wider mb-1"
                            style={{
                              color: "var(--pro)",
                              fontWeight: 700,
                              letterSpacing: "0.06em",
                            }}
                          >
                            You
                          </div>
                          <div
                            className="text-[13.5px] leading-relaxed whitespace-pre-wrap"
                            style={{ color: "var(--foreground)" }}
                          >
                            {userText}
                          </div>
                        </div>
                      ) : null}
                      {asstText ? (
                        <div>
                          <div
                            className="text-[10px] uppercase tracking-wider mb-1"
                            style={{
                              color: "var(--accent)",
                              fontWeight: 700,
                              letterSpacing: "0.06em",
                            }}
                          >
                            Coach
                          </div>
                          <div
                            className="text-[13.5px] leading-relaxed"
                            style={{ color: "var(--foreground-soft)" }}
                          >
                            <CoachMarkdown text={asstText} />
                          </div>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDateHeading(iso: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (iso === today) return "Today";
  if (iso === yesterday) return "Yesterday";
  // "Apr 27, 2026" style
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

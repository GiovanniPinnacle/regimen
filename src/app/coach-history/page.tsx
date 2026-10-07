// /coach-history — scroll-back archive of past Coach conversations.
//
// Reads from claude_conversations (one row per turn since the persist
// landing in /api/ask). Renders newest-first, day-grouped, with copy
// buttons on each turn. Read-only — Coach picks up new threads from
// the Coach FAB on /today.

import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Section";
import { AskAgainButton, ContinueButton } from "./HistoryActions";
import EmptyGlyph from "@/components/EmptyGlyph";
import CoachMarkdown from "@/components/CoachMarkdown";
import { addDaysISO, localDateISO } from "@/lib/series";
import { getUserToday } from "@/lib/user-date";

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
      <div className="pb-28">
        <PageHeader
          back="/coach"
          backLabel="Coach"
          title="Coach history"
          showCoach={false}
        />
        <Card padding="lg" className="text-center">
          <p className="text-callout text-[var(--muted)]">
            Sign in to see your past conversations with Coach.
          </p>
          <ButtonLink href="/signin" variant="primary" className="mt-4">
            Sign in
          </ButtonLink>
        </Card>
      </div>
    );
  }
  // RLS on claude_conversations restricts to auth.uid() = user_id
  // (migration 001 generic owner policy). Cookied client is the
  // safer default — admin escalation here was unnecessary.
  const { data, error } = await supabase
    .from("claude_conversations")
    .select("id, created_at, messages_json")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(60);

  if (error) console.error("coach-history: claude_conversations", error);
  const rows = (data ?? []) as Row[];

  // Group by the user's LOCAL calendar day (created_at is a UTC
  // timestamp; the server clock is UTC).
  const { today, timeZone } = await getUserToday(supabase, user.id);
  type Group = { date: string; rows: Row[] };
  const groups: Group[] = [];
  for (const r of rows) {
    const d = localDateISO(new Date(r.created_at), timeZone);
    const last = groups[groups.length - 1];
    if (last && last.date === d) last.rows.push(r);
    else groups.push({ date: d, rows: [r] });
  }

  return (
    <div className="pb-28">
      <PageHeader
        back="/coach"
        backLabel="Coach"
        title="Coach history"
        subtitle="Your conversations with Coach, newest first."
        actions={<ContinueButton />}
        showCoach={false}
      />

      {rows.length === 0 ? (
        <Card padding="lg" className="text-center">
          <div className="mb-4 flex justify-center">
            <EmptyGlyph icon="sparkle" tone="pro" size={64} />
          </div>
          <div className="text-title-3">No conversations yet</div>
          <p className="mx-auto mt-1 max-w-sm text-callout text-[var(--muted)]">
            Tap the sparkle on any screen to ask Coach about your routine.
            Your conversations will show up here.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col">
          {groups.map((g) => (
            <section key={g.date} className="mt-7 first:mt-0">
              <Eyebrow className="mb-2.5 px-1">{formatDateHeading(g.date, today)}</Eyebrow>
              <div className="flex flex-col gap-3">
                {g.rows.map((row) => {
                  const userText = userTextFromJson(row.messages_json?.user);
                  const asstText =
                    typeof row.messages_json?.assistant === "string"
                      ? (row.messages_json.assistant as string)
                      : "";
                  const time = new Date(row.created_at).toLocaleTimeString(
                    "en-US",
                    { hour: "numeric", minute: "2-digit", timeZone },
                  );
                  return (
                    <article
                      key={row.id}
                      id={`t-${row.id}`}
                      className="scroll-mt-6 rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-4 target:border-[var(--pro)]"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-caption tabular-nums text-[var(--muted)]">
                          {time}
                        </span>
                        {userText && <AskAgainButton text={userText} />}
                      </div>
                      {userText ? (
                        <p className="mb-3 whitespace-pre-wrap text-callout font-semibold">
                          {userText}
                        </p>
                      ) : null}
                      {asstText ? (
                        <div className="text-callout text-[var(--foreground-soft)]">
                          <CoachMarkdown text={asstText} />
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

function formatDateHeading(iso: string, today: string): string {
  if (iso === today) return "Today";
  if (iso === addDaysISO(today, -1)) return "Yesterday";
  // "Apr 27, 2026" style. Pin UTC so the calendar date isn't shifted by
  // the runtime's zone.
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

"use client";

// CoachMarkdown — lightweight inline renderer for Coach chat messages.
//
// Coach output is markdown-shaped (bold, bullet lists, numbered lists,
// occasional headings). Before this component the chat dumped raw text
// with `whitespace-pre-wrap`, which left users staring at literal
// asterisks like "**Cleanest fix:**". This renders the common subset
// without pulling in a full markdown library — keeps the bundle small
// and the styling tight + on-brand.
//
// Supported:
//   **bold**, *italic* / _italic_ (single-line), `inline code`
//   [links](https://…) — http(s), mailto and in-app paths only
//   # / ## / ### headings
//   - bullets, * bullets, • bullets
//   1. numbered lists
//   ``` fenced code blocks ```
//   | simple | pipe | tables |
//   blank line → paragraph break
//
// Text inherits the caller's size (chat bubble / memo); nothing renders
// below text-caption. Markers and links stay neutral — green is
// success-only, violet is reserved for Coach chrome around this.
//
// If Coach output ever needs richer markdown, swap this for
// react-markdown — keep the API (a single `text` prop) so the call sites
// don't change.

import { Fragment, useMemo } from "react";

type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "h"; level: number; text: string }
  | { kind: "code"; lines: string[] }
  | { kind: "table"; header: string[]; rows: string[][] };

function splitRow(line: string): string[] {
  return line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

const TABLE_SEPARATOR = /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/;

function parseBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  let ul: string[] = [];
  let ol: string[] = [];
  let table: string[] = [];
  let code: string[] | null = null;

  function flushPara() {
    if (para.length > 0) {
      blocks.push({ kind: "p", lines: para });
      para = [];
    }
  }
  function flushLists() {
    if (ul.length > 0) {
      blocks.push({ kind: "ul", items: ul });
      ul = [];
    }
    if (ol.length > 0) {
      blocks.push({ kind: "ol", items: ol });
      ol = [];
    }
  }
  function flushTable() {
    if (table.length === 0) return;
    const rows = table
      .filter((r) => !TABLE_SEPARATOR.test(r))
      .map(splitRow);
    const hasHeader = table.length > 1 && TABLE_SEPARATOR.test(table[1]);
    if (hasHeader) {
      blocks.push({ kind: "table", header: rows[0], rows: rows.slice(1) });
    } else {
      blocks.push({ kind: "table", header: [], rows });
    }
    table = [];
  }
  function flushAll() {
    flushPara();
    flushLists();
    flushTable();
  }

  for (const raw of lines) {
    const line = raw.trim();

    // Fenced code — everything until the closing fence is literal.
    if (code) {
      if (line.startsWith("```")) {
        blocks.push({ kind: "code", lines: code });
        code = null;
      } else {
        code.push(raw);
      }
      continue;
    }
    if (line.startsWith("```")) {
      flushAll();
      code = [];
      continue;
    }

    if (line === "") {
      flushAll();
      continue;
    }

    if (line.startsWith("|") && line.indexOf("|", 1) > 0) {
      flushPara();
      flushLists();
      table.push(line);
      continue;
    }
    flushTable();

    const hMatch = line.match(/^(#{1,6})\s+(.*?)\s*#*$/);
    if (hMatch) {
      flushPara();
      flushLists();
      blocks.push({ kind: "h", level: hMatch[1].length, text: hMatch[2] });
      continue;
    }

    const ulMatch = line.match(/^[-*•]\s+(.*)$/);
    const olMatch = line.match(/^(\d+)[.)]\s+(.*)$/);
    if (ulMatch) {
      flushPara();
      if (ol.length > 0) flushLists();
      ul.push(ulMatch[1]);
      continue;
    }
    if (olMatch) {
      flushPara();
      if (ul.length > 0) flushLists();
      ol.push(olMatch[2]);
      continue;
    }
    // Plain line — accumulate into the current paragraph.
    flushLists();
    para.push(line);
  }
  // Unclosed fence — still show what we have.
  if (code) blocks.push({ kind: "code", lines: code });
  flushAll();
  return blocks;
}

/** Only follow links that are safe to open from AI text. */
function safeHref(url: string): string | null {
  const u = url.trim();
  if (/^https?:\/\//i.test(u) || /^mailto:/i.test(u)) return u;
  if (u.startsWith("/") && !u.startsWith("//")) return u;
  return null;
}

const LINK_CLS =
  "font-medium text-[var(--foreground)] underline decoration-[var(--border-strong)] underline-offset-2 hover:decoration-[var(--foreground)]";

/** Render inline marks (code, links, bold, italic) in a single line. */
function renderInline(text: string): React.ReactNode {
  // Token order matters: code first (eats nested *), then links, then
  // bold (** ... **), then italic (* ... * or _ ... _).
  const parts: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  const re =
    /(`[^`]+`)|(\[[^\]]+\]\([^)\s]+\))|(\*\*[^*]+\*\*)|(\*[^*\n]+\*)|(_[^_\n]+_)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    if (match.index > i) {
      parts.push(
        <Fragment key={key++}>{text.slice(i, match.index)}</Fragment>,
      );
    }
    const tok = match[0];
    if (tok.startsWith("`")) {
      parts.push(
        <code
          key={key++}
          className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-alt)] px-1 py-0.5 font-mono text-[0.92em]"
        >
          {tok.slice(1, -1)}
        </code>,
      );
    } else if (tok.startsWith("[")) {
      const m = tok.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
      const label = m?.[1] ?? tok;
      const href = m ? safeHref(m[2]) : null;
      if (href) {
        const external = !href.startsWith("/");
        parts.push(
          <a
            key={key++}
            href={href}
            className={LINK_CLS}
            {...(external
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
          >
            {label}
          </a>,
        );
      } else {
        parts.push(<Fragment key={key++}>{label}</Fragment>);
      }
    } else if (tok.startsWith("**")) {
      parts.push(
        <strong key={key++} className="font-semibold text-[var(--foreground)]">
          {tok.slice(2, -2)}
        </strong>,
      );
    } else if (tok.startsWith("*") || tok.startsWith("_")) {
      parts.push(<em key={key++}>{tok.slice(1, -1)}</em>);
    }
    i = match.index + tok.length;
  }
  if (i < text.length) parts.push(<Fragment key={key++}>{text.slice(i)}</Fragment>);
  return parts;
}

export default function CoachMarkdown({
  text,
  /** Restrict bullet lists' max width — keeps long sentences from
   *  hitting the bubble's right edge mid-word. Caller controls outer
   *  width; we just render. */
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const blocks = useMemo(() => parseBlocks(text), [text]);
  return (
    <div className={`flex min-w-0 flex-col gap-2.5 ${className}`}>
      {blocks.map((b, idx) => {
        if (b.kind === "p") {
          return (
            <p key={idx} className="leading-relaxed">
              {b.lines.map((ln, j) => (
                <Fragment key={j}>
                  {j > 0 ? <br /> : null}
                  {renderInline(ln)}
                </Fragment>
              ))}
            </p>
          );
        }
        if (b.kind === "h") {
          const cls =
            b.level <= 2
              ? "text-body font-semibold leading-snug text-[var(--foreground)]"
              : "text-callout font-semibold leading-snug text-[var(--foreground)]";
          return (
            <p key={idx} role="heading" aria-level={Math.min(b.level + 2, 6)} className={`${cls} ${idx > 0 ? "mt-1" : ""}`}>
              {renderInline(b.text)}
            </p>
          );
        }
        if (b.kind === "code") {
          return (
            <pre
              key={idx}
              className="overflow-x-auto rounded-[10px] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2.5 font-mono text-caption leading-relaxed text-[var(--foreground-soft)]"
            >
              <code>{b.lines.join("\n")}</code>
            </pre>
          );
        }
        if (b.kind === "table") {
          return (
            <div
              key={idx}
              className="-mx-0.5 overflow-x-auto rounded-[10px] border border-[var(--border)]"
            >
              <table className="w-full border-collapse text-left text-footnote">
                {b.header.length > 0 && (
                  <thead className="bg-[var(--surface-alt)]">
                    <tr>
                      {b.header.map((h, j) => (
                        <th
                          key={j}
                          scope="col"
                          className="whitespace-nowrap px-2.5 py-2 text-caption font-semibold text-[var(--foreground-soft)]"
                        >
                          {renderInline(h)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                )}
                <tbody>
                  {b.rows.map((row, r) => (
                    <tr
                      key={r}
                      className={r > 0 || b.header.length > 0 ? "border-t border-[var(--border)]" : ""}
                    >
                      {row.map((cell, j) => (
                        <td key={j} className="px-2.5 py-2 align-top tabular-nums">
                          {renderInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (b.kind === "ul") {
          return (
            <ul key={idx} className="flex flex-col gap-1 pl-1">
              {b.items.map((it, j) => (
                <li key={j} className="flex gap-2 leading-relaxed">
                  <span
                    aria-hidden
                    className="mt-px shrink-0 select-none text-[var(--muted)]"
                  >
                    •
                  </span>
                  <span className="min-w-0 flex-1">{renderInline(it)}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <ol key={idx} className="flex flex-col gap-1 pl-1">
            {b.items.map((it, j) => (
              <li key={j} className="flex gap-2 leading-relaxed">
                <span
                  aria-hidden
                  className="w-4 shrink-0 select-none text-right font-semibold tabular-nums text-[var(--muted)]"
                >
                  {j + 1}.
                </span>
                <span className="min-w-0 flex-1">{renderInline(it)}</span>
              </li>
            ))}
          </ol>
        );
      })}
    </div>
  );
}

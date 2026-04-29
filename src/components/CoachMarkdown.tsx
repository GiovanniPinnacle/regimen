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
//   **bold**, *italic* (single-line),
//   - bullets, * bullets, • bullets
//   1. numbered lists
//   `inline code`
//   blank line → paragraph break
//   line ending in ":" treated as a sub-heading row
//
// Deliberately NOT supported (Coach doesn't use them):
//   headings (#), links, images, tables, code blocks
//
// If Coach output ever needs richer markdown, swap this for
// react-markdown — keep the API (a single `text` prop) so the call sites
// don't change.

import { Fragment, useMemo } from "react";

type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] };

function parseBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  let ul: string[] = [];
  let ol: string[] = [];

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

  for (const raw of lines) {
    const line = raw.trim();
    if (line === "") {
      flushPara();
      flushLists();
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
  flushPara();
  flushLists();
  return blocks;
}

/** Render inline marks (bold + italic + inline code) in a single line. */
function renderInline(text: string): React.ReactNode {
  // Token order matters: code first (eats nested *), then bold (** ... **),
  // then italic (* ... * or _ ... _).
  const parts: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  // Combined regex — captures the leading literal too.
  const re =
    /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\n]+\*)|(_[^_\n]+_)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    if (match.index > i) {
      parts.push(
        <Fragment key={key++}>{text.slice(i, match.index)}</Fragment>,
      );
    }
    const tok = match[0];
    if (tok.startsWith("**")) {
      parts.push(
        <strong key={key++} className="font-semibold">
          {tok.slice(2, -2)}
        </strong>,
      );
    } else if (tok.startsWith("`")) {
      parts.push(
        <code
          key={key++}
          className="rounded px-1 py-0.5 text-[0.92em]"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
          }}
        >
          {tok.slice(1, -1)}
        </code>,
      );
    } else if (tok.startsWith("*")) {
      parts.push(
        <em key={key++}>{tok.slice(1, -1)}</em>,
      );
    } else if (tok.startsWith("_")) {
      parts.push(
        <em key={key++}>{tok.slice(1, -1)}</em>,
      );
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
    <div className={`flex flex-col gap-2.5 ${className}`}>
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
        if (b.kind === "ul") {
          return (
            <ul key={idx} className="flex flex-col gap-1 pl-1">
              {b.items.map((it, j) => (
                <li key={j} className="flex gap-2 leading-relaxed">
                  <span
                    aria-hidden
                    style={{ color: "var(--accent)", marginTop: 1 }}
                    className="shrink-0 select-none"
                  >
                    •
                  </span>
                  <span className="flex-1 min-w-0">{renderInline(it)}</span>
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
                  style={{ color: "var(--pro)", fontWeight: 600 }}
                  className="shrink-0 select-none w-4 text-right"
                >
                  {j + 1}.
                </span>
                <span className="flex-1 min-w-0">{renderInline(it)}</span>
              </li>
            ))}
          </ol>
        );
      })}
    </div>
  );
}

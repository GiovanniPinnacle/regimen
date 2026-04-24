// Parse Claude's <<<PROPOSAL ... PROPOSAL>>> blocks from streamed text.

export type Proposal = {
  id: string; // stable hash so we can dedupe across stream updates
  action: "add" | "update" | "retire" | "promote" | "queue" | "adjust";
  item_name: string;
  reasoning?: string;
  // Freeform fields Claude may include: dose, timing_slot, category, status, goals, notes, item_type, etc.
  extra?: Record<string, string>;
};

const BLOCK_RE = /<<<PROPOSAL\s*([\s\S]*?)\s*PROPOSAL>>>/g;
const LINE_RE = /^\s*([a-zA-Z_]+)\s*:\s*(.+?)\s*$/;

export function parseProposals(text: string): Proposal[] {
  const out: Proposal[] = [];
  for (const match of text.matchAll(BLOCK_RE)) {
    const body = match[1];
    const fields: Record<string, string> = {};
    for (const line of body.split(/\r?\n/)) {
      const m = line.match(LINE_RE);
      if (m) fields[m[1].toLowerCase()] = m[2];
    }
    if (!fields.item_name || !fields.action) continue;

    const known = new Set([
      "action",
      "item_name",
      "reasoning",
    ]);
    const extra: Record<string, string> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (!known.has(k)) extra[k] = v;
    }

    const action = fields.action.toLowerCase() as Proposal["action"];
    // Stable ID: hash-like of action + item_name
    const id = `${action}:${fields.item_name}`;
    out.push({
      id,
      action,
      item_name: fields.item_name,
      reasoning: fields.reasoning,
      extra: Object.keys(extra).length > 0 ? extra : undefined,
    });
  }
  return out;
}

// Remove proposal blocks from display text (we show them as cards instead)
export function stripProposals(text: string): string {
  return text.replace(BLOCK_RE, "").trim();
}

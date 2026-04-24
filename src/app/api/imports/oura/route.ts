// POST Oura CSV → parse → upsert rows into oura_daily
// Expected headers are flexible — we map known columns case-insensitively.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

function parseCsv(text: string): Record<string, string>[] {
  const lines = text
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = splitLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = splitLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = cells[i] ?? ""));
    return row;
  });
}

function splitLine(line: string): string[] {
  // Simple CSV split (no quoted commas handling — Oura exports don't need it)
  const out: string[] = [];
  let cur = "";
  let inQuote = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuote = !inQuote;
    } else if (ch === "," && !inQuote) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function findKey(row: Record<string, string>, patterns: RegExp[]): string | undefined {
  for (const key of Object.keys(row)) {
    for (const p of patterns) if (p.test(key)) return key;
  }
  return undefined;
}

function toInt(v: string | undefined): number | null {
  if (!v) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}
function toNum(v: string | undefined): number | null {
  if (!v) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return NextResponse.json({ error: "Empty CSV" }, { status: 400 });
  }

  // Find columns by regex against header names
  const first = rows[0];
  const keys = {
    date: findKey(first, [/^date$/i, /^day$/i]),
    readiness: findKey(first, [/readiness.*score/i, /^readiness$/i]),
    hrv: findKey(first, [/hrv/i]),
    rhr: findKey(first, [/resting.*heart.*rate/i, /lowest.*heart.*rate/i, /^rhr$/i]),
    deep: findKey(first, [/deep.*sleep/i]),
    rem: findKey(first, [/rem.*sleep/i]),
    total: findKey(first, [/total.*sleep/i]),
    temp: findKey(first, [/temperature.*deviation/i, /skin.*temperature/i]),
  };

  if (!keys.date) {
    return NextResponse.json(
      { error: "No date column found in CSV", headers: Object.keys(first) },
      { status: 400 },
    );
  }

  const dbRows = rows
    .map((r) => {
      const date = r[keys.date as string];
      if (!date) return null;
      return {
        user_id: user.id,
        date: date.slice(0, 10),
        readiness: toInt(keys.readiness ? r[keys.readiness] : undefined),
        hrv: toInt(keys.hrv ? r[keys.hrv] : undefined),
        rhr: toInt(keys.rhr ? r[keys.rhr] : undefined),
        deep_sleep_min: toInt(keys.deep ? r[keys.deep] : undefined),
        rem_sleep_min: toInt(keys.rem ? r[keys.rem] : undefined),
        total_sleep_min: toInt(keys.total ? r[keys.total] : undefined),
        temp_deviation: toNum(keys.temp ? r[keys.temp] : undefined),
      };
    })
    .filter(Boolean);

  const { error } = await supabase.from("oura_daily").upsert(dbRows, {
    onConflict: "user_id,date",
  });
  if (error) {
    console.error("oura upsert", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Also record the import
  await supabase.from("data_imports").insert({
    user_id: user.id,
    source_type: "oura_csv",
    parsed_json: { rows: dbRows.length, columns_mapped: keys },
    date_range_start: dbRows[dbRows.length - 1]?.date,
    date_range_end: dbRows[0]?.date,
  });

  return NextResponse.json({
    ok: true,
    inserted: dbRows.length,
    columns_mapped: keys,
  });
}

// Oura v2 API client. Uses Personal Access Tokens (PAT).
// Fetches sleep + readiness data for a date range.

export type OuraSleepSession = {
  id: string;
  day: string; // YYYY-MM-DD
  bedtime_start: string; // ISO
  bedtime_end: string; // ISO = wake time
  total_sleep_duration: number; // seconds
  deep_sleep_duration: number;
  rem_sleep_duration: number;
  average_hrv?: number;
  average_heart_rate?: number;
  lowest_heart_rate?: number;
  type: string; // long_sleep | nap | etc
};

export type OuraDailySleep = {
  id: string;
  day: string;
  score: number;
  timestamp: string;
};

export type OuraReadiness = {
  id: string;
  day: string;
  score: number;
  temperature_deviation?: number;
  temperature_trend_deviation?: number;
};

const BASE = "https://api.ouraring.com/v2/usercollection";

async function fetchOura<T>(
  endpoint: string,
  pat: string,
  params: Record<string, string> = {},
): Promise<T> {
  const url = new URL(`${BASE}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${pat}` },
  });
  if (!r.ok) {
    throw new Error(`Oura ${endpoint} ${r.status}: ${await r.text()}`);
  }
  return (await r.json()) as T;
}

export async function fetchOuraSleep(
  pat: string,
  startDate: string,
  endDate: string,
): Promise<OuraSleepSession[]> {
  const data = await fetchOura<{ data: OuraSleepSession[] }>("sleep", pat, {
    start_date: startDate,
    end_date: endDate,
  });
  return data.data.filter((s) => s.type === "long_sleep");
}

export async function fetchOuraDailySleep(
  pat: string,
  startDate: string,
  endDate: string,
): Promise<OuraDailySleep[]> {
  const data = await fetchOura<{ data: OuraDailySleep[] }>(
    "daily_sleep",
    pat,
    {
      start_date: startDate,
      end_date: endDate,
    },
  );
  return data.data;
}

export async function fetchOuraReadiness(
  pat: string,
  startDate: string,
  endDate: string,
): Promise<OuraReadiness[]> {
  const data = await fetchOura<{ data: OuraReadiness[] }>(
    "daily_readiness",
    pat,
    {
      start_date: startDate,
      end_date: endDate,
    },
  );
  return data.data;
}

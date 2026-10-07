// Page through a PostgREST query past the server's row cap.
//
// Supabase/PostgREST returns at most `max_rows` (1000 by default) rows per
// request — silently. `.limit(3000)` does NOT lift it. Any query whose
// result can exceed 1000 rows (stack_log for a 50-item stack over 30
// days, intake_log over a few months, …) must page with `.range()`.
//
// Pure (no Supabase import) so it's unit-testable with a fake client.

/** PostgREST's default `max_rows`. */
export const PAGE_SIZE = 1000;

/** Hard ceiling so a pathological account can't loop forever (20k rows). */
export const DEFAULT_MAX_PAGES = 20;

/** Structural subset of PostgrestError. */
export type PageError = { message: string } | null;

export type PageResult = { data: unknown[] | null; error: PageError };

/** Builds ONE page of the query: must return a stably ordered
 *  `.range(from, to)` query (order by a unique key, or by date + id),
 *  otherwise rows can repeat or go missing across pages. */
export type PageFn = (from: number, to: number) => PromiseLike<PageResult>;

/**
 * Supabase-shaped result: `{ data, error }`. `data` holds every row
 * fetched before an error (if any), so callers that already branch on
 * `res.error` keep working unchanged.
 */
export async function fetchAllRowsResult<T>(
  page: PageFn,
  maxPages = DEFAULT_MAX_PAGES,
  pageSize = PAGE_SIZE,
): Promise<{ data: T[]; error: PageError }> {
  const out: T[] = [];
  for (let p = 0; p < maxPages; p++) {
    const { data, error } = await page(p * pageSize, p * pageSize + pageSize - 1);
    if (error) return { data: out, error };
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return { data: out, error: null };
}

/**
 * Rows only — logs (and swallows) errors under `where`, returning
 * whatever was fetched. For loaders that treat a failed read as "no data".
 */
export async function fetchAllRows<T>(
  page: PageFn,
  where: string,
  maxPages = DEFAULT_MAX_PAGES,
): Promise<T[]> {
  const { data, error } = await fetchAllRowsResult<T>(page, maxPages);
  if (error) console.error(`fetchAllRows: ${where}`, error);
  return data;
}

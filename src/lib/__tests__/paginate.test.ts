import { describe, expect, it, vi } from "vitest";
import {
  fetchAllRows,
  fetchAllRowsResult,
  PAGE_SIZE,
  type PageResult,
} from "@/lib/supabase/paginate";

/** Fake PostgREST: serves `total` rows, at most `cap` per request,
 *  honoring the inclusive `.range(from, to)` like the real thing. */
function fakeTable(total: number, cap = PAGE_SIZE) {
  const rows = Array.from({ length: total }, (_, i) => ({ id: i }));
  const calls: [number, number][] = [];
  const page = (from: number, to: number): Promise<PageResult> => {
    calls.push([from, to]);
    const end = Math.min(to + 1, from + cap);
    return Promise.resolve({ data: rows.slice(from, end), error: null });
  };
  return { page, calls };
}

describe("fetchAllRowsResult", () => {
  it("returns everything past the 1000-row cap", async () => {
    const t = fakeTable(2500);
    const res = await fetchAllRowsResult<{ id: number }>(t.page);
    expect(res.error).toBeNull();
    expect(res.data).toHaveLength(2500);
    expect(res.data[0].id).toBe(0);
    expect(res.data[2499].id).toBe(2499);
    expect(t.calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("makes one request when the result fits in a page", async () => {
    const t = fakeTable(12);
    const res = await fetchAllRowsResult(t.page);
    expect(res.data).toHaveLength(12);
    expect(t.calls).toHaveLength(1);
  });

  it("stops after an exact multiple of the page size", async () => {
    const t = fakeTable(2000);
    const res = await fetchAllRowsResult(t.page);
    expect(res.data).toHaveLength(2000);
    // third call returns 0 rows and ends the loop
    expect(t.calls).toHaveLength(3);
  });

  it("handles an empty table and null data", async () => {
    const res = await fetchAllRowsResult(() =>
      Promise.resolve({ data: null, error: null }),
    );
    expect(res).toEqual({ data: [], error: null });
  });

  it("returns the rows fetched before an error, plus the error", async () => {
    let n = 0;
    const res = await fetchAllRowsResult<number>(() => {
      n++;
      return Promise.resolve(
        n === 1
          ? { data: Array(PAGE_SIZE).fill(1), error: null }
          : { data: null, error: { message: "boom" } },
      );
    });
    expect(res.data).toHaveLength(PAGE_SIZE);
    expect(res.error).toEqual({ message: "boom" });
  });

  it("respects maxPages", async () => {
    const t = fakeTable(10_000);
    const res = await fetchAllRowsResult(t.page, 3);
    expect(res.data).toHaveLength(3000);
    expect(t.calls).toHaveLength(3);
  });
});

describe("fetchAllRows", () => {
  it("logs and swallows errors", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const rows = await fetchAllRows(
      () => Promise.resolve({ data: null, error: { message: "nope" } }),
      "test",
    );
    expect(rows).toEqual([]);
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
});

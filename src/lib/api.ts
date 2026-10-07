// Shared helpers for route handlers under src/app/api/**.

import { NextResponse } from "next/server";

/** Uniform JSON error body: `{ error: message, code }`. `error` stays the
 *  human-readable string the client components already render. */
export function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ error: message, code }, { status });
}

/** Parse a request body as JSON. Returns `{ ok: false, response }` with a
 *  400 when the body is missing or malformed so the route can return it
 *  directly instead of throwing into a 500.
 *
 *    const body = await readJson<{ name?: string }>(request);
 *    if (!body.ok) return body.response;
 *    const { name } = body.data;
 */
export async function readJson<T = Record<string, unknown>>(
  request: Request,
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  try {
    const data = (await request.json()) as T;
    if (data === null || typeof data !== "object") {
      return {
        ok: false,
        response: jsonError("bad_request", "Request body must be a JSON object.", 400),
      };
    }
    return { ok: true, data };
  } catch {
    return {
      ok: false,
      response: jsonError("bad_request", "Request body is not valid JSON.", 400),
    };
  }
}

/** Constant-time-ish bearer check for cron routes. Rejects when
 *  CRON_SECRET is unset — an unset secret must never mean "open". */
export function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (header.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < header.length; i++) {
    diff |= header.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

/** Log + 500 for unexpected errors in a route's top-level catch. */
export function internalError(route: string, err: unknown) {
  console.error(`${route} failed:`, err);
  return jsonError("internal", "Something went wrong. Please try again.", 500);
}

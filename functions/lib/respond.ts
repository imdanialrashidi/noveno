/**
 * Shared JSON response helpers (plan §5.5 response contract).
 */

import type { ErrorCode } from "./contract.ts";

export function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export function errorResponse(code: ErrorCode, status: number, fields?: Record<string, string>): Response {
  return jsonResponse({ ok: false, error: { code, ...(fields ? { fields } : {}) } }, status);
}

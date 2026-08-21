/**
 * Shared JSON response helpers (plan §5.5 response contract).
 */

import type { ErrorCode } from "./contract.ts";

const RESPONSE_HEADERS: Record<string, string> = {
  "content-type": "application/json; charset=utf-8",
  // API responses are never cacheable and must never be MIME-sniffed.
  // (_headers does not reliably cover Pages Function responses.)
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

export function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...RESPONSE_HEADERS } });
}

export function errorResponse(code: ErrorCode, status: number, fields?: Record<string, string>): Response {
  return jsonResponse({ ok: false, error: { code, ...(fields ? { fields } : {}) } }, status);
}

#!/usr/bin/env node
/**
 * Slice-2 deterministic test server (verification tooling, not product).
 *
 * Mimics the Cloudflare Pages shape for browser QA of the audit flow:
 * serves the built site from dist/ and runs the REAL Pages Functions
 * (functions/api/audit.ts + events.ts) with controllable external
 * dependencies — mock Supabase (in-process PostgREST), mock Web3Forms,
 * and a recording Analytics Engine binding — so every trust-boundary
 * state can be exercised in a real browser without credentials.
 *
 * Modes (--mode):
 *   ok              everything succeeds (Turnstile always-pass secret)
 *   supabase-down   mock Supabase insert fails → 502
 *   web3forms-down  mock notification endpoint fails → thank-you anyway
 *   turnstile-fail  Turnstile secret = always-fail → 403
 *
 * Test-inspection endpoints (never part of the functions/ boundary):
 *   GET /api/__test/leads          stored lead rows
 *   GET /api/__test/events         recorded analytics data points
 *   GET /api/__test/notifications  web3forms-mock request count
 *
 * Usage: node scripts/slice2-test-server.mjs [--mode ok] [--port 8788]
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

const args = process.argv.slice(2);
const mode = args.includes("--mode") ? args[args.indexOf("--mode") + 1] : "ok";
const port = args.includes("--port") ? Number(args[args.indexOf("--port") + 1]) : 8788;

const TURNSTILE = {
  alwaysPass: "1x0000000000000000000000000000000AA",
  alwaysFail: "2x0000000000000000000000000000000AA",
};

const { onRequest: auditOnRequest } = await import(
  fileURLToPath(new URL("../functions/api/audit.ts", import.meta.url))
);
const { onRequest: eventsOnRequest } = await import(
  fileURLToPath(new URL("../functions/api/events.ts", import.meta.url))
);

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

const leads = new Map(); // submission_id → row
const eventPoints = [];
const notifications = [];
let failInserts = mode === "supabase-down";

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/* ------------------------------------------------------------------ */
/* Mock PostgREST (minimal /rest/v1/leads semantics)                   */
/* ------------------------------------------------------------------ */

async function mockPostgrest(req, res, body) {
  if (req.method === "POST") {
    if (failInserts) return json(res, 500, { message: "boom" });
    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      return json(res, 400, { message: "invalid body" });
    }
    const row = Array.isArray(payload) ? payload[0] : payload;
    if (!row || typeof row.submission_id !== "string") {
      return json(res, 400, { message: "invalid row" });
    }
    if (leads.has(row.submission_id)) return json(res, 201, []);
    const stored = { ...row, id: `mock-${leads.size + 1}` };
    leads.set(row.submission_id, stored);
    return json(res, 201, [stored]);
  }
  if (req.method === "GET") {
    const url = new URL(req.url, "http://localhost");
    const param = url.searchParams.get("submission_id") ?? "";
    const value = param.startsWith("eq.") ? param.slice(3) : null;
    const matches = [...leads.values()].filter((r) => value === null || r.submission_id === value);
    const wantsSingle = (req.headers.accept ?? "").includes("application/vnd.pgrst.object+json");
    if (wantsSingle) {
      if (matches.length === 1) return json(res, 200, matches[0]);
      return json(res, 406, {
        code: "PGRST116",
        details: `The result contains ${matches.length} rows`,
        hint: null,
        message: "JSON object requested, multiple (or no) rows returned",
      });
    }
    return json(res, 200, matches);
  }
  return json(res, 405, { message: "method not allowed" });
}

/* ------------------------------------------------------------------ */
/* HTTP server                                                         */
/* ------------------------------------------------------------------ */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
  const pathname = url.pathname;

  try {
    /* --- test inspection endpoints --- */
    if (pathname === "/api/__test/leads" && req.method === "GET") {
      return json(res, 200, [...leads.values()]);
    }
    if (pathname === "/api/__test/events" && req.method === "GET") {
      return json(res, 200, eventPoints);
    }
    if (pathname === "/api/__test/notifications" && req.method === "GET") {
      return json(res, 200, notifications);
    }
    if (pathname === "/api/__test/mode" && req.method === "GET") {
      return json(res, 200, { mode, failInserts });
    }

    /* --- mock Web3Forms (client notification endpoint) --- */
    if (pathname === "/api/web3forms-mock" && req.method === "POST") {
      const body = await readBody(req);
      notifications.push(JSON.parse(body || "{}"));
      if (mode === "web3forms-down") return json(res, 500, { success: false });
      return json(res, 200, { success: true });
    }

    /* --- mock Supabase (PostgREST) --- */
    if (pathname === "/rest/v1/leads") {
      return mockPostgrest(req, res, await readBody(req));
    }

    /* --- real Pages Functions --- */
    if (pathname === "/api/audit") {
      const request = new Request(`http://127.0.0.1:${port}/api/audit`, {
        method: req.method,
        headers: {
          "content-type": req.headers["content-type"] ?? "",
          "content-length": req.headers["content-length"] ?? "",
          "cf-connecting-ip": req.headers["cf-connecting-ip"] ?? "127.0.0.1",
        },
        body: ["POST", "PUT", "PATCH"].includes(req.method) ? await readBody(req) : undefined,
      });
      const response = await auditOnRequest({
        request,
        env: {
          SUPABASE_URL: `http://127.0.0.1:${port}`,
          SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
          TURNSTILE_SECRET_KEY: mode === "turnstile-fail" ? TURNSTILE.alwaysFail : TURNSTILE.alwaysPass,
        },
      });
      res.writeHead(response.status, { "content-type": "application/json; charset=utf-8" });
      return res.end(await response.text());
    }

    if (pathname === "/api/events") {
      const request = new Request(`http://127.0.0.1:${port}/api/events`, {
        method: req.method,
        headers: {
          "content-type": req.headers["content-type"] ?? "",
          "content-length": req.headers["content-length"] ?? "",
        },
        body: ["POST", "PUT", "PATCH"].includes(req.method) ? await readBody(req) : undefined,
      });
      const response = await eventsOnRequest({
        request,
        env: {
          NOVENO_EVENTS: {
            writeDataPoint: (data) => eventPoints.push({ ...data, receivedAt: Date.now() }),
          },
        },
      });
      res.writeHead(response.status, {
        "content-type": response.headers.get("content-type") ?? "application/json",
      });
      return res.end(await response.text());
    }

    /* --- static site --- */
    const rel = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
    const candidates = [
      path.join(dist, rel),
      path.join(dist, rel, "index.html"),
      path.join(dist, rel + ".html"),
    ];
    const file = candidates.find((c) => fs.existsSync(c) && fs.statSync(c).isFile());
    if (file) {
      const ext = path.extname(file);
      res.writeHead(200, {
        "content-type": CONTENT_TYPES[ext] ?? "application/octet-stream",
        "cache-control": "no-store",
      });
      return res.end(fs.readFileSync(file));
    }
    return json(res, 404, { ok: false, error: "not found" });
  } catch (err) {
    console.error("[test-server] error:", err.message);
    return json(res, 500, { ok: false, error: "server_error" });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`slice2 test server (mode=${mode}) on http://127.0.0.1:${port}`);
});

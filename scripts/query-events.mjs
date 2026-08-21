#!/usr/bin/env node
// Tiny Analytics Engine reader — spike prototype, not a product dependency.
// Reads CLOUDFLARE_API_TOKEN + CF_ACCOUNT_ID from env (never committed).
// Usage: CF_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... node scripts/query-events.mjs --range 7

const range = (() => {
  const idx = process.argv.indexOf("--range");
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : "7";
})();

console.log(`[spike] would query noveno_events last ${range}d: COUNT by event, by step/service/channel`);
console.log("[spike] not querying without credentials — run with CF_ACCOUNT_ID + CLOUDFLARE_API_TOKEN to hit Analytics Engine SQL API");

const accountId = process.env.CF_ACCOUNT_ID ?? process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN ?? process.env.CLOUDFLARE_TOKEN;

if (accountId && token) {
  console.log(`[spike] credentials present (account ${accountId.slice(0, 4)}****) — would POST to https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`);
  console.log(`[spike] query: SELECT index1 AS event, COUNT(*) AS n FROM noveno_events WHERE timestamp > NOW() - INTERVAL '${range}' DAY GROUP BY index1 ORDER BY n DESC`);
  console.log("[spike] (not actually fetching without real token + dataset provisioned per docs/ops/setup-checklist.md:3.4)");
}

process.exit(0);

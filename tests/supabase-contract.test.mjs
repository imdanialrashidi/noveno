/**
 * Supabase migration contract (plan §5.7, QUALITY invariants 4–5).
 *
 * Proves the lead schema is the single source of truth and that the
 * trust invariants are enforced at the database layer:
 *   - exactly one launch migration;
 *   - `submission_id` is unique (idempotency hard guarantee);
 *   - RLS enabled with zero policies (no public lead-read capability);
 *   - no grants to anon/authenticated;
 *   - the function's persistence row shape matches the migration columns
 *     (drift guard: functions/lib/persist.ts ↔ supabase migration).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { toLeadRow } from "../functions/api/audit.ts";

const root = path.resolve(import.meta.dirname, "..");
const migrationsDir = path.join(root, "supabase", "migrations");

function readMigration() {
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
  assert.equal(files.length, 1, `expected exactly one launch migration, found: ${files.join(", ")}`);
  return fs.readFileSync(path.join(migrationsDir, files[0]), "utf8");
}

test("migration enables RLS with zero policies and no public grants", () => {
  const sql = readMigration();
  assert.match(sql, /create table if not exists public\.leads/, "leads table must be created");
  assert.match(sql, /enable row level security/, "RLS must be enabled");
  assert.doesNotMatch(sql, /create\s+policy/i, "zero policies: no RLS policy may exist");
  assert.doesNotMatch(
    sql,
    /grant[^;]*(anon|authenticated)[^;]*;/i,
    "no grants to anon/authenticated roles",
  );
});

test("submission_id is unique — the idempotency hard guarantee", () => {
  const sql = readMigration();
  assert.match(sql, /submission_id\s+uuid\s+not\s+null\s+unique/, "submission_id must be unique");
});

test("persistence row shape matches the migration columns exactly", () => {
  const sql = readMigration();
  const tableBlock = sql.match(/create table if not exists public\.leads\s*\(([\s\S]*?)\)\s*;/)?.[1];
  assert.ok(tableBlock, "create table block not found");
  const migrationColumns = new Set(
    [...tableBlock.matchAll(/^\s{2}([a-z_]+)\s/mg)].map((m) => m[1]),
  );

  const sample = toLeadRow(
    {
      submission_id: "00000000-0000-0000-0000-000000000001",
      name: "x",
      phone: "09353598620",
      preferred_contact: "phone",
      industry: "other",
      acquisition_channels: ["other"],
      primary_problem: "not_sure",
      requested_service: "not_sure_yet",
      attribution: {},
    },
    "2026-08-11T12:00:00.000Z",
  );
  const rowKeys = Object.keys(sample);

  // every column the function writes must exist in the migration
  for (const key of rowKeys) {
    assert.ok(migrationColumns.has(key), `migration missing column the function writes: ${key}`);
  }

  // every migration column must be written by the function or be DB-managed
  const dbManaged = new Set(["id", "created_at", "submitted_at", "status", "owner"]);
  for (const column of migrationColumns) {
    assert.ok(
      rowKeys.includes(column) || dbManaged.has(column),
      `migration column not written by the function and not DB-managed: ${column}`,
    );
  }
});

test("no secrets or connection strings appear in the migration", () => {
  const sql = readMigration();
  assert.doesNotMatch(sql, /(service_role|sb_publishable|eyJ|postgres:\/\/)/i);
});

test("local secrets files are gitignored (.dev.vars is the documented dev secret file)", () => {
  const ignore = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
  assert.match(ignore, /^\.dev\.vars$/m, ".gitignore must ignore .dev.vars");
  assert.match(ignore, /^\.dev\.vars\.\*$/m, ".gitignore must ignore .dev.vars.*");
  assert.match(ignore, /^\.env$/m, ".gitignore must ignore .env");
  // and no tracked file currently holds dev-secret content
  const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      return e.isDirectory() ? walk(p) : [p];
    });
  const tracked = walk(root).filter(
    (f) =>
      !f.includes(`${path.sep}node_modules${path.sep}`) &&
      !f.includes(`${path.sep}dist${path.sep}`) &&
      !f.includes(`${path.sep}.git${path.sep}`) &&
      !f.includes(`${path.sep}.pi${path.sep}`) &&
      !f.includes(`${path.sep}.artifacts${path.sep}`) &&
      !f.includes(`${path.sep}.astro${path.sep}`),
  );
  for (const file of tracked) {
    assert.ok(!file.endsWith(".dev.vars"), `tracked dev-secret file: ${file}`);
    const name = file.split(path.sep).pop();
    assert.ok(
      name === ".env.example" || !/^\.env($|\.)/.test(name),
      `tracked env file: ${file}`,
    );
  }
});

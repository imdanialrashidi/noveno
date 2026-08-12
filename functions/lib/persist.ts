/**
 * Supabase lead persistence (plan §5.7) — the source of truth.
 *
 * Invariant: 200 is only reachable after Supabase accepts the row.
 * Idempotency: insert with `onConflict('submission_id').ignore()`; a
 * conflict means the lead already exists from an earlier delivery of the
 * same submission — the function then re-selects the existing row and
 * returns a truthful success with its id (plan A5 / R7). The unique
 * constraint in the migration is the hard guarantee; this re-select is
 * the same-origin confirmation path.
 *
 * The service-role key bypasses RLS and must never exist outside this
 * server-side module (RLS is enabled with zero policies in the migration).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface LeadRow {
  submission_id: string;
  name: string;
  phone: string;
  email: string | null;
  preferred_contact: string;
  business_name: string | null;
  industry: string;
  website: string | null;
  acquisition_channels: string[];
  primary_problem: string;
  requested_service: string;
  customer_value_range: string | null;
  source: string;
  landing_page: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  first_seen_at: string | null;
}

export interface PersistResult {
  /** 'inserted' = this delivery created the row; 'replay' = row already existed. */
  status: "inserted" | "replay";
  id: string;
}

export interface Persister {
  persistLead(row: LeadRow): Promise<PersistResult>;
}

export function createSupabasePersister(
  url: string,
  serviceRoleKey: string,
  clientImpl: (url: string, key: string) => SupabaseClient = createClient,
): Persister {
  const supabase = clientImpl(url, serviceRoleKey);

  return {
    async persistLead(row: LeadRow): Promise<PersistResult> {
      const { data, error } = await supabase
        .from("leads")
        .upsert(row, { onConflict: "submission_id", ignoreDuplicates: true })
        .select("id");

      if (error) {
        throw new Error(`lead insert failed: ${error.message}`);
      }
      if (data && data.length > 0) {
        return { status: "inserted", id: data[0].id as string };
      }

      // Conflict path: the row exists from an earlier delivery. Confirm it
      // with a direct lookup — if it is somehow absent, this is a
      // persistence failure, never a success.
      const { data: existing, error: selectError } = await supabase
        .from("leads")
        .select("id")
        .eq("submission_id", row.submission_id)
        .maybeSingle();

      if (selectError) {
        throw new Error(`lead replay confirm failed: ${selectError.message}`);
      }
      if (existing) {
        return { status: "replay", id: existing.id as string };
      }
      throw new Error("lead insert ignored but no existing row found");
    },
  };
}

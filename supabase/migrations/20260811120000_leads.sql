-- Noveno launch — leads table (docs/exec-plans/active/noveno-launch.md §5.7).
-- Minimal, additive-only at launch: only the fields the audit form collects
-- plus ops defaults. Deferred until operations need them (schema-additive,
-- non-breaking): notes, last_contact_at, next_action_at, lost_reason.
--
-- Apply via the Supabase SQL editor or `supabase db push` (founder-owned).
-- Rollback = drop table / restore from backup; see docs/ops/runbook.md.

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique,
  created_at timestamptz not null default now(),
  name text not null,
  phone text not null,
  email text,
  preferred_contact text not null,
  business_name text,
  industry text,
  website text,
  acquisition_channels jsonb not null default '[]'::jsonb,
  primary_problem text not null,
  requested_service text not null,
  customer_value_range text,
  source text not null default 'website',
  landing_page text,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  first_seen_at timestamptz,
  submitted_at timestamptz not null default now(),
  status text not null default 'new',
  owner text
);

-- RLS enabled with ZERO policies: no anon/authenticated read or write —
-- there is no public lead-read capability, ever. The Pages Function
-- writes with the service-role key (server-side secret only), which
-- bypasses RLS. Do not add policies without a deliberate security review.
alter table public.leads enable row level security;

-- Deliberately absent: no RLS policy statements and no role grants
-- exist in this migration (see above).

comment on table public.leads is
  'Noveno audit submissions — business-critical. Written only by the Cloudflare Pages Function (service-role key).';

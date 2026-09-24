-- Fix PostgREST on_conflict compatibility for merch prospect upserts.
-- Application code normalizes prospect emails to lowercase before insert.
create unique index if not exists merch_prospects_org_email_exact_all_uq
  on public.merch_prospects (organization_id, email);
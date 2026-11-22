-- Canonical project scoping for the shared BCO commercial records.
-- Legacy UI keys map at the application boundary: merch -> nrsm, jihoceske -> fve.
-- Contacts remain shared; project ownership belongs to leads/opportunities and downstream records.

alter table public.contacts
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.leads
  add column if not exists project_id text not null default 'unassigned',
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.opportunities
  add column if not exists project_id text not null default 'unassigned',
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.quotes
  add column if not exists project_id text not null default 'unassigned',
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.merch_orders
  add column if not exists project_id text not null default 'unassigned';

alter table public.financial_entries
  add column if not exists project_id text not null default 'unassigned',
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists idempotency_key text;

alter table public.jobs
  add column if not exists project_id text not null default 'unassigned',
  add column if not exists metadata jsonb not null default '{}'::jsonb;

do $$
declare
  t text;
  c text;
begin
  foreach t in array array['leads','opportunities','quotes','merch_orders','financial_entries','jobs'] loop
    c := t || '_project_id_check';
    if not exists (
      select 1 from pg_constraint
      where conname = c
        and conrelid = ('public.' || t)::regclass
    ) then
      execute format(
        'alter table public.%I add constraint %I check (project_id in (''fve'',''nrsm'',''mazliprint'',''local-proof-factory'',''unassigned'')) not valid',
        t, c
      );
    end if;
  end loop;
end $$;

alter table public.leads validate constraint leads_project_id_check;
alter table public.opportunities validate constraint opportunities_project_id_check;
alter table public.quotes validate constraint quotes_project_id_check;
alter table public.merch_orders validate constraint merch_orders_project_id_check;
alter table public.financial_entries validate constraint financial_entries_project_id_check;
alter table public.jobs validate constraint jobs_project_id_check;

create index if not exists leads_org_project_status_idx
  on public.leads (organization_id, project_id, status, created_at desc);
create index if not exists opportunities_org_project_stage_idx
  on public.opportunities (organization_id, project_id, stage, created_at desc);
create index if not exists quotes_org_project_status_idx
  on public.quotes (organization_id, project_id, status, created_at desc);
create index if not exists merch_orders_org_project_status_idx
  on public.merch_orders (organization_id, project_id, status, created_at desc);
create index if not exists financial_entries_org_project_date_idx
  on public.financial_entries (organization_id, project_id, occurred_on desc);
create index if not exists jobs_org_project_status_idx
  on public.jobs (organization_id, project_id, status, created_at desc);

create unique index if not exists financial_entries_org_idempotency_key_uq
  on public.financial_entries (organization_id, idempotency_key)
  where idempotency_key is not null;

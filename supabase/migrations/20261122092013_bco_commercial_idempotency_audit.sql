-- Commercial write idempotency and complete audit coverage for BCO staging.
-- Existing records are preserved. No production project is referenced.
alter table public.contacts add column if not exists idempotency_key text;
alter table public.leads add column if not exists idempotency_key text;
alter table public.opportunities add column if not exists idempotency_key text;
alter table public.quotes add column if not exists idempotency_key text;
alter table public.merch_orders add column if not exists idempotency_key text;

create unique index if not exists contacts_org_idempotency_key_uq
  on public.contacts (organization_id, idempotency_key) where idempotency_key is not null;
create unique index if not exists leads_org_idempotency_key_uq
  on public.leads (organization_id, idempotency_key) where idempotency_key is not null;
create unique index if not exists opportunities_org_idempotency_key_uq
  on public.opportunities (organization_id, idempotency_key) where idempotency_key is not null;
create unique index if not exists quotes_org_idempotency_key_uq
  on public.quotes (organization_id, idempotency_key) where idempotency_key is not null;
create unique index if not exists merch_orders_org_idempotency_key_uq
  on public.merch_orders (organization_id, idempotency_key) where idempotency_key is not null;

do $$
declare
  t text;
begin
  foreach t in array array['contacts','opportunities','quotes','merch_orders','financial_entries'] loop
    execute format('drop trigger if exists audit_%I_change on public.%I', t, t);
    execute format(
      'create trigger audit_%I_change after insert or update or delete on public.%I for each row execute function public.audit_business_change()',
      t, t
    );
  end loop;
end $$;

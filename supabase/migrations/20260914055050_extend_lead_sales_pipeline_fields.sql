alter table public.leads
  add column if not exists qualified_at timestamptz,
  add column if not exists offered_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists invoiced_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists invoiced_amount numeric,
  add column if not exists paid_amount numeric;

alter table public.leads drop constraint if exists leads_status_check;
alter table public.leads add constraint leads_status_check check (status = any (array[
  'new'::text,
  'contacted'::text,
  'qualified'::text,
  'follow_up'::text,
  'offer'::text,
  'approved'::text,
  'job'::text,
  'delivered'::text,
  'invoiced'::text,
  'paid'::text,
  'closed'::text,
  'won'::text,
  'lost'::text
]));

create table if not exists public.merch_products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sku text not null,
  name text not null,
  collection text,
  description text,
  active boolean not null default true,
  price numeric not null default 0 check (price >= 0),
  currency text not null default 'CZK',
  variants jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, sku)
);

create table if not exists public.merch_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  order_number text not null,
  status text not null default 'new' check (status in ('new','confirmed','paid','production','ready','shipped','delivered','cancelled','refunded')),
  source text,
  currency text not null default 'CZK',
  subtotal numeric not null default 0 check (subtotal >= 0),
  shipping numeric not null default 0 check (shipping >= 0),
  total numeric not null default 0 check (total >= 0),
  customer_note text,
  internal_note text,
  shipping_data jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, order_number)
);

create table if not exists public.merch_order_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_id uuid not null references public.merch_orders(id) on delete cascade,
  product_id uuid references public.merch_products(id) on delete set null,
  product_name text not null,
  sku text,
  variant jsonb not null default '{}'::jsonb,
  quantity numeric not null default 1 check (quantity > 0),
  unit_price numeric not null default 0 check (unit_price >= 0),
  line_total numeric not null default 0 check (line_total >= 0),
  created_at timestamptz not null default now()
);

create index if not exists merch_products_org_active_idx on public.merch_products(organization_id, active);
create index if not exists merch_orders_org_status_idx on public.merch_orders(organization_id, status, created_at desc);
create index if not exists merch_orders_contact_idx on public.merch_orders(contact_id, created_at desc);
create index if not exists merch_order_items_order_idx on public.merch_order_items(order_id);

alter table public.merch_products enable row level security;
alter table public.merch_orders enable row level security;
alter table public.merch_order_items enable row level security;

create policy merch_products_member_select on public.merch_products for select using (exists (select 1 from public.memberships m where m.organization_id = merch_products.organization_id and m.user_id = auth.uid()));
create policy merch_products_member_write on public.merch_products for all using (exists (select 1 from public.memberships m where m.organization_id = merch_products.organization_id and m.user_id = auth.uid() and m.role in ('owner','admin','manager'))) with check (exists (select 1 from public.memberships m where m.organization_id = merch_products.organization_id and m.user_id = auth.uid() and m.role in ('owner','admin','manager')));
create policy merch_orders_member_select on public.merch_orders for select using (exists (select 1 from public.memberships m where m.organization_id = merch_orders.organization_id and m.user_id = auth.uid()));
create policy merch_orders_member_write on public.merch_orders for all using (exists (select 1 from public.memberships m where m.organization_id = merch_orders.organization_id and m.user_id = auth.uid() and m.role in ('owner','admin','manager'))) with check (exists (select 1 from public.memberships m where m.organization_id = merch_orders.organization_id and m.user_id = auth.uid() and m.role in ('owner','admin','manager')));
create policy merch_order_items_member_select on public.merch_order_items for select using (exists (select 1 from public.memberships m where m.organization_id = merch_order_items.organization_id and m.user_id = auth.uid()));
create policy merch_order_items_member_write on public.merch_order_items for all using (exists (select 1 from public.memberships m where m.organization_id = merch_order_items.organization_id and m.user_id = auth.uid() and m.role in ('owner','admin','manager'))) with check (exists (select 1 from public.memberships m where m.organization_id = merch_order_items.organization_id and m.user_id = auth.uid() and m.role in ('owner','admin','manager')));

create or replace function public.set_merch_updated_at() returns trigger language plpgsql set search_path = public as $ begin new.updated_at = now(); return new; end $;
drop trigger if exists merch_products_updated_at on public.merch_products;
create trigger merch_products_updated_at before update on public.merch_products for each row execute function public.set_merch_updated_at();
drop trigger if exists merch_orders_updated_at on public.merch_orders;
create trigger merch_orders_updated_at before update on public.merch_orders for each row execute function public.set_merch_updated_at();

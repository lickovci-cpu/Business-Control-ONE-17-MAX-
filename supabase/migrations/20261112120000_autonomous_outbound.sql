-- Autonomous outbound foundation. Safe defaults: no campaign is enabled by this migration.
-- Supabase remains the sole CRM source of truth.
create table if not exists public.outreach_campaign_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  slug text not null,
  name text not null,
  channel text not null default 'email' check (channel in ('email')),
  status text not null default 'draft' check (status in ('draft','approved','paused','revoked')),
  legal_basis text not null default 'unknown' check (legal_basis in ('consent','existing_customer_exception','unknown')),
  legal_basis_description text,
  evidence_reference text,
  approved_by text,
  approved_at timestamptz,
  valid_from timestamptz,
  valid_until timestamptz,
  max_messages_per_day integer not null default 0 check (max_messages_per_day between 0 and 100),
  max_messages_per_contact integer not null default 1 check (max_messages_per_contact between 1 and 10),
  max_total_messages integer not null default 0 check (max_total_messages between 0 and 10000),
  allowed_recipient_scope text not null default 'explicitly_eligible_only' check (allowed_recipient_scope = 'explicitly_eligible_only'),
  policy_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug),
  check ((status <> 'approved') or (approved_at is not null and approved_by is not null and valid_from is not null and valid_until is not null and legal_basis <> 'unknown' and length(coalesce(legal_basis_description,'')) > 0 and length(coalesce(evidence_reference,'')) > 0 and max_messages_per_day > 0 and max_total_messages > 0))
);

create table if not exists public.outreach_suppressions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  channel text not null default 'email' check (channel='email'),
  recipient_normalized text not null check (recipient_normalized=lower(trim(recipient_normalized))),
  reason text not null default 'unsubscribe',
  source text,
  created_at timestamptz not null default now(),
  unique (organization_id, channel, recipient_normalized)
);

create table if not exists public.outbound_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete restrict,
  lead_id uuid references public.leads(id) on delete set null,
  campaign_policy_id uuid references public.outreach_campaign_policies(id) on delete restrict,
  channel text not null default 'email' check (channel='email'),
  recipient text not null,
  recipient_normalized text not null,
  subject text not null default '',
  body text not null,
  status text not null default 'draft' check (status in ('draft','eligible','queued','processing','accepted','delivered','failed','needs_review','suppressed','cancelled')),
  legal_basis text not null default 'unknown' check (legal_basis in ('consent','existing_customer_exception','unknown')),
  legal_basis_evidence text,
  consent_status text not null default 'unknown' check (consent_status in ('granted','customer_exception_verified','unknown','withdrawn')),
  consent_source text,
  consent_evidence text,
  consent_at timestamptz,
  do_not_contact boolean not null default false,
  idempotency_key text not null,
  provider text,
  provider_message_id text,
  scheduled_at timestamptz,
  queued_at timestamptz,
  processing_started_at timestamptz,
  accepted_at timestamptz,
  delivered_at timestamptz,
  attempts integer not null default 0 check (attempts between 0 and 5),
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, idempotency_key),
  check (contact_id is not null)
);

create table if not exists public.outreach_audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  outbound_message_id uuid references public.outbound_messages(id) on delete set null,
  campaign_policy_id uuid references public.outreach_campaign_policies(id) on delete set null,
  event_type text not null,
  actor text not null default 'system',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.outbound_provider_credentials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider='microsoft_graph'),
  credential_ciphertext text not null,
  credential_iv text not null,
  credential_tag text not null,
  credential_version integer not null default 1,
  expires_at timestamptz,
  scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider)
);

create index if not exists outbound_messages_due_idx on public.outbound_messages(status, scheduled_at) where status in ('queued','eligible');
create index if not exists outbound_messages_org_created_idx on public.outbound_messages(organization_id, created_at desc);
create index if not exists outreach_audit_org_created_idx on public.outreach_audit_events(organization_id, created_at desc);
create index if not exists outreach_suppressions_lookup_idx on public.outreach_suppressions(organization_id, recipient_normalized);

create or replace function public.bco_validate_outbound_message_scope()
returns trigger language plpgsql set search_path=public as $$
declare
  linked_contact_id uuid;
  linked_contact_email text;
  linked_lead_org uuid;
  linked_lead_contact_id uuid;
begin
  new.recipient_normalized=lower(trim(new.recipient));
  if new.contact_id is not null then
    select c.email into linked_contact_email from public.contacts c where c.id=new.contact_id and c.organization_id=new.organization_id;
    if not found then raise exception 'OUTBOUND_CONTACT_ORGANIZATION_MISMATCH'; end if;
    if linked_contact_email is null or lower(trim(linked_contact_email))<>new.recipient_normalized then raise exception 'OUTBOUND_RECIPIENT_CONTACT_EMAIL_MISMATCH'; end if;
  end if;
  if new.lead_id is not null then
    select l.organization_id,l.contact_id into linked_lead_org,linked_lead_contact_id from public.leads l where l.id=new.lead_id;
    if not found or linked_lead_org<>new.organization_id then raise exception 'OUTBOUND_LEAD_ORGANIZATION_MISMATCH'; end if;
    if linked_lead_contact_id is null then raise exception 'OUTBOUND_LEAD_WITHOUT_CONTACT'; end if;
    if linked_lead_contact_id<>new.contact_id then raise exception 'OUTBOUND_LEAD_CONTACT_MISMATCH'; end if;
  end if;
  if new.campaign_policy_id is not null and not exists (
    select 1 from public.outreach_campaign_policies p where p.id=new.campaign_policy_id and p.organization_id=new.organization_id
  ) then raise exception 'OUTBOUND_POLICY_ORGANIZATION_MISMATCH'; end if;
  new.updated_at=now();
  return new;
end $$;

drop trigger if exists trg_bco_validate_outbound_message_scope on public.outbound_messages;
create trigger trg_bco_validate_outbound_message_scope before insert or update on public.outbound_messages
for each row execute function public.bco_validate_outbound_message_scope();
revoke all on function public.bco_validate_outbound_message_scope() from public, anon, authenticated;
grant execute on function public.bco_validate_outbound_message_scope() to service_role;

alter table public.outreach_campaign_policies enable row level security;
alter table public.outreach_suppressions enable row level security;
alter table public.outbound_messages enable row level security;
alter table public.outreach_audit_events enable row level security;
alter table public.outbound_provider_credentials enable row level security;

-- No direct browser/client access. Only the server-side service credential may access these tables.
revoke all on public.outreach_campaign_policies, public.outreach_suppressions, public.outbound_messages, public.outreach_audit_events, public.outbound_provider_credentials from anon, authenticated;
grant all on public.outreach_campaign_policies, public.outreach_suppressions, public.outbound_messages, public.outreach_audit_events, public.outbound_provider_credentials to service_role;
grant usage, select on sequence public.outreach_audit_events_id_seq to service_role;

comment on table public.outbound_messages is 'Persistent, auditable outbound email queue. All records default to draft; only approved campaign policy and verified legal basis can be dispatched.';
comment on table public.outreach_campaign_policies is 'One-time human-approved campaign policy. No policy is approved by default.';
comment on table public.outbound_provider_credentials is 'Encrypted OAuth refresh credential; encryption key is held only in server environment.';

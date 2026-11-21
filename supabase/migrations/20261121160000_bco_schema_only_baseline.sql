-- Schema-only baseline generated from production catalog. No application rows, auth users, storage objects, secrets or credentials are included.

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.normalize_phone(input text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
  select case
    when regexp_replace(coalesce(input,''),'[^0-9]','','g') like '00%'
      then substring(regexp_replace(coalesce(input,''),'[^0-9]','','g') from 3)
    when length(regexp_replace(coalesce(input,''),'[^0-9]','','g'))=9
      then '420'||regexp_replace(coalesce(input,''),'[^0-9]','','g')
    else regexp_replace(coalesce(input,''),'[^0-9]','','g')
  end
$function$;




CREATE TABLE public.ai_agent_events (id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  agent_id uuid,
  event_type text NOT NULL,
  severity text DEFAULT 'info'::text NOT NULL,
  entity_type text,
  entity_id uuid,
  payload jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public.ai_agents (id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  slug text NOT NULL,
  name text NOT NULL,
  description text DEFAULT ''::text NOT NULL,
  active boolean DEFAULT true NOT NULL,
  autonomy_level text DEFAULT 'approval'::text NOT NULL,
  allowed_actions jsonb DEFAULT '[]'::jsonb NOT NULL,
  config jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public.ai_approvals (id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  agent_id uuid NOT NULL,
  action_type text NOT NULL,
  entity_type text,
  entity_id uuid,
  payload jsonb DEFAULT '{}'::jsonb NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  requested_at timestamp with time zone DEFAULT now() NOT NULL,
  resolved_at timestamp with time zone,
  resolved_by uuid,
  resolution_note text,
  executed_at timestamp with time zone);

CREATE TABLE public.ai_runs (id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  user_id uuid,
  agent text NOT NULL,
  task text NOT NULL,
  status text DEFAULT 'completed'::text NOT NULL,
  provider text,
  model text,
  input jsonb DEFAULT '{}'::jsonb NOT NULL,
  output jsonb DEFAULT '{}'::jsonb NOT NULL,
  error text,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public.app_snapshots (id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  app_key text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public.audit_log (id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  organization_id uuid,
  actor_user_id uuid,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public.automation_runs (id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  automation_id uuid NOT NULL,
  status text DEFAULT 'running'::text NOT NULL,
  input jsonb DEFAULT '{}'::jsonb NOT NULL,
  output jsonb DEFAULT '{}'::jsonb NOT NULL,
  error text,
  started_at timestamp with time zone DEFAULT now() NOT NULL,
  completed_at timestamp with time zone);

CREATE TABLE public.automations (id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  name text NOT NULL,
  active boolean DEFAULT true NOT NULL,
  trigger_type text NOT NULL,
  trigger_config jsonb DEFAULT '{}'::jsonb NOT NULL,
  action_config jsonb DEFAULT '{}'::jsonb NOT NULL,
  last_run_at timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public.bco_integrations (id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  provider text NOT NULL,
  name text NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  external_ref text,
  capabilities jsonb DEFAULT '[]'::jsonb NOT NULL,
  config jsonb DEFAULT '{}'::jsonb NOT NULL,
  credential_ref text,
  last_checked_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public.bco_websites (id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  name text NOT NULL,
  url text NOT NULL,
  status text DEFAULT 'active'::text NOT NULL,
  platform text,
  repo_ref text,
  deploy_ref text,
  capabilities jsonb DEFAULT '["audit", "seo", "content", "forms"]'::jsonb NOT NULL,
  config jsonb DEFAULT '{}'::jsonb NOT NULL,
  last_audit_at timestamp with time zone,
  last_deploy_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public.booking_throttle (id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  organization_id uuid,
  ip_hash text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public.contacts (id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  name text,
  phone text,
  email text,
  address text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  phone_normalized text GENERATED ALWAYS AS (private.normalize_phone(phone)) STORED);

CREATE TABLE public.content_items (id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  title text NOT NULL,
  content_type text DEFAULT 'post'::text NOT NULL,
  platform text DEFAULT 'web'::text NOT NULL,
  status text DEFAULT 'draft'::text NOT NULL,
  body text,
  asset_ids uuid[] DEFAULT '{}'::uuid[],
  tags text[] DEFAULT '{}'::text[],
  scheduled_at timestamp with time zone,
  published_at timestamp with time zone,
  external_url text,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public.conversations (id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  contact_id uuid,
  phone text,
  source text,
  status text DEFAULT 'open'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public.financial_entries (id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  entry_type text NOT NULL,
  category text NOT NULL,
  amount numeric(14,2) NOT NULL,
  currency text DEFAULT 'CZK'::text NOT NULL,
  occurred_on date DEFAULT CURRENT_DATE NOT NULL,
  status text DEFAULT 'planned'::text NOT NULL,
  counterparty text,
  reference text,
  note text,
  job_id uuid,
  opportunity_id uuid,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public.integration_webhook_tokens (id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  kind text NOT NULL,
  token_hash text NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public.job_assignments (organization_id uuid NOT NULL,
  job_id uuid NOT NULL,
  user_id uuid NOT NULL);

CREATE TABLE public.job_checklist_items (id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  job_id uuid NOT NULL,
  label text NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  done boolean DEFAULT false NOT NULL,
  done_at timestamp with time zone);

CREATE TABLE public.job_photos (id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  job_id uuid NOT NULL,
  phase text NOT NULL,
  storage_path text NOT NULL,
  caption text,
  captured_at timestamp with time zone DEFAULT now() NOT NULL,
  lat double precision,
  lng double precision);

CREATE TABLE public.job_signatures (id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  job_id uuid NOT NULL,
  signer_name text,
  storage_path text NOT NULL,
  signed_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public.jobs (id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  contact_id uuid,
  title text NOT NULL,
  address text,
  status text DEFAULT 'planned'::text NOT NULL,
  scheduled_at timestamp with time zone,
  note text,
  price numeric(12,2),
  direct_cost numeric(12,2),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public.leads (id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  contact_id uuid,
  source text,
  status text DEFAULT 'new'::text NOT NULL,
  estimated_value numeric(12,2),
  note text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  next_action_at timestamp with time zone,
  last_contact_at timestamp with time zone,
  qualified_at timestamp with time zone,
  offered_at timestamp with time zone,
  approved_at timestamp with time zone,
  delivered_at timestamp with time zone,
  invoiced_at timestamp with time zone,
  paid_at timestamp with time zone,
  invoiced_amount numeric,
  paid_amount numeric);

CREATE TABLE public.media_assets (id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  name text NOT NULL,
  kind text DEFAULT 'file'::text NOT NULL,
  status text DEFAULT 'ready'::text NOT NULL,
  storage_path text,
  thumb_path text,
  mime_type text,
  size_bytes bigint,
  width integer,
  height integer,
  tags text[] DEFAULT '{}'::text[],
  linked_type text,
  linked_id uuid,
  prompt text,
  generation_provider text,
  generation_model text,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public.memberships (organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public.merch_creative_proposals (id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  prospect_id uuid,
  product_id uuid,
  provider text NOT NULL,
  prompt text NOT NULL,
  image_url text,
  preview_url text,
  variant text,
  score integer,
  status text DEFAULT 'candidate'::text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  selected_at timestamp with time zone);

CREATE TABLE public.merch_order_items (id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  order_id uuid NOT NULL,
  product_id uuid,
  product_name text NOT NULL,
  sku text,
  variant jsonb DEFAULT '{}'::jsonb NOT NULL,
  quantity numeric DEFAULT 1 NOT NULL,
  unit_price numeric DEFAULT 0 NOT NULL,
  line_total numeric DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public.merch_orders (id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  contact_id uuid,
  lead_id uuid,
  order_number text NOT NULL,
  status text DEFAULT 'new'::text NOT NULL,
  source text,
  currency text DEFAULT 'CZK'::text NOT NULL,
  subtotal numeric DEFAULT 0 NOT NULL,
  shipping numeric DEFAULT 0 NOT NULL,
  total numeric DEFAULT 0 NOT NULL,
  customer_note text,
  internal_note text,
  shipping_data jsonb DEFAULT '{}'::jsonb NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public.merch_outreach_drafts (id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  prospect_id uuid NOT NULL,
  channel text NOT NULL,
  subject text,
  body text NOT NULL,
  personalization jsonb DEFAULT '{}'::jsonb NOT NULL,
  status text DEFAULT 'draft'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  approved_at timestamp with time zone,
  sent_at timestamp with time zone);

CREATE TABLE public.merch_products (id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  sku text NOT NULL,
  name text NOT NULL,
  collection text,
  description text,
  active boolean DEFAULT true NOT NULL,
  price numeric DEFAULT 0 NOT NULL,
  currency text DEFAULT 'CZK'::text NOT NULL,
  variants jsonb DEFAULT '[]'::jsonb NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public.merch_prospects (id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  company_name text,
  domain text,
  contact_name text,
  email text,
  phone text,
  source text,
  source_url text,
  fit_score integer,
  status text DEFAULT 'discovered'::text NOT NULL,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  last_contact_at timestamp with time zone,
  next_action_at timestamp with time zone);

CREATE TABLE public.messages (id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  conversation_id uuid,
  direction text NOT NULL,
  channel text NOT NULL,
  phone text,
  body text NOT NULL,
  provider text,
  provider_message_id text,
  status text,
  created_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public.missed_calls (id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  contact_id uuid,
  conversation_id uuid,
  lead_id uuid,
  phone text NOT NULL,
  provider text,
  provider_event_id text,
  occurred_at timestamp with time zone DEFAULT now() NOT NULL,
  sms_status text DEFAULT 'not_attempted'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public.opportunities (id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  contact_id uuid,
  title text NOT NULL,
  stage text DEFAULT 'lead'::text NOT NULL,
  priority text DEFAULT 'B'::text NOT NULL,
  value numeric(14,2),
  probability numeric(5,2),
  source text,
  next_action text,
  next_action_at timestamp with time zone,
  notes text,
  owner_user_id uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public.organizations (id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  slug text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  phone text,
  email text,
  address text,
  ico text,
  booking_enabled boolean DEFAULT true NOT NULL,
  booking_intro text,
  sms_enabled boolean DEFAULT false NOT NULL,
  sms_provider text DEFAULT 'bulkgate'::text NOT NULL,
  sms_sender text,
  missed_call_template text DEFAULT 'Dobrý den, omlouváme se, váš hovor jsme nestihli přijmout. Napište prosím stručně, s čím potřebujete pomoci, a ozveme se.'::text NOT NULL,
  plan text DEFAULT 'beta'::text NOT NULL,
  subscription_status text DEFAULT 'beta'::text NOT NULL,
  trial_ends_at timestamp with time zone,
  sms_daily_limit integer DEFAULT 100 NOT NULL,
  sms_monthly_limit integer DEFAULT 1000 NOT NULL);

CREATE TABLE public.quote_items (id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  quote_id uuid NOT NULL,
  description text NOT NULL,
  quantity numeric(12,3) DEFAULT 1 NOT NULL,
  unit text DEFAULT 'ks'::text NOT NULL,
  unit_price numeric(14,2) DEFAULT 0 NOT NULL,
  tax_rate numeric(5,2) DEFAULT 21 NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public.quotes (id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  quote_number text NOT NULL,
  contact_id uuid,
  opportunity_id uuid,
  status text DEFAULT 'draft'::text NOT NULL,
  subtotal numeric(14,2) DEFAULT 0 NOT NULL,
  tax numeric(14,2) DEFAULT 0 NOT NULL,
  total numeric(14,2) DEFAULT 0 NOT NULL,
  currency text DEFAULT 'CZK'::text NOT NULL,
  valid_until date,
  issued_at timestamp with time zone,
  accepted_at timestamp with time zone,
  pdf_path text,
  notes text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public.service_bookings (id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  name text NOT NULL,
  phone text NOT NULL,
  email text,
  address text,
  service text NOT NULL,
  preferred_at timestamp with time zone,
  note text,
  status text DEFAULT 'new'::text NOT NULL,
  source text DEFAULT 'web'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public.service_catalog (id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  name text NOT NULL,
  category text,
  price_from numeric(12,2),
  unit text,
  active boolean DEFAULT true NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public.tasks (id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  title text NOT NULL,
  status text DEFAULT 'open'::text NOT NULL,
  priority text DEFAULT 'B'::text NOT NULL,
  due_at timestamp with time zone,
  assigned_to uuid,
  entity_type text,
  entity_id uuid,
  notes text,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public.team_invites (id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  email text NOT NULL,
  role text NOT NULL,
  token_hash text NOT NULL,
  created_by uuid NOT NULL,
  expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval) NOT NULL,
  accepted_at timestamp with time zone,
  accepted_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public.time_entries (id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid NOT NULL,
  job_id uuid NOT NULL,
  user_id uuid NOT NULL,
  started_at timestamp with time zone DEFAULT now() NOT NULL,
  ended_at timestamp with time zone,
  note text,
  created_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public.webhook_events (id uuid DEFAULT gen_random_uuid() NOT NULL,
  organization_id uuid,
  provider text NOT NULL,
  event_type text NOT NULL,
  dedupe_key text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL);





ALTER TABLE public.ai_agent_events ADD CONSTRAINT ai_agent_events_pkey PRIMARY KEY (id);

ALTER TABLE public.ai_agent_events ADD CONSTRAINT ai_agent_events_severity_check CHECK (severity = ANY (ARRAY['debug'::text, 'info'::text, 'warning'::text, 'error'::text]));

ALTER TABLE public.ai_agents ADD CONSTRAINT ai_agents_autonomy_level_check CHECK (autonomy_level = ANY (ARRAY['draft'::text, 'approval'::text, 'supervised'::text, 'autonomous'::text]));


ALTER TABLE public.ai_agents ADD CONSTRAINT ai_agents_organization_id_slug_key UNIQUE (organization_id, slug);

ALTER TABLE public.ai_agents ADD CONSTRAINT ai_agents_pkey PRIMARY KEY (id);



ALTER TABLE public.ai_approvals ADD CONSTRAINT ai_approvals_pkey PRIMARY KEY (id);

ALTER TABLE public.ai_approvals ADD CONSTRAINT ai_approvals_status_check CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'expired'::text, 'executed'::text]));


ALTER TABLE public.ai_runs ADD CONSTRAINT ai_runs_pkey PRIMARY KEY (id);

ALTER TABLE public.ai_runs ADD CONSTRAINT ai_runs_status_check CHECK (status = ANY (ARRAY['queued'::text, 'running'::text, 'completed'::text, 'failed'::text, 'cancelled'::text]));



ALTER TABLE public.app_snapshots ADD CONSTRAINT app_snapshots_organization_id_user_id_app_key_key UNIQUE (organization_id, user_id, app_key);

ALTER TABLE public.app_snapshots ADD CONSTRAINT app_snapshots_pkey PRIMARY KEY (id);




ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);



ALTER TABLE public.automation_runs ADD CONSTRAINT automation_runs_pkey PRIMARY KEY (id);

ALTER TABLE public.automation_runs ADD CONSTRAINT automation_runs_status_check CHECK (status = ANY (ARRAY['running'::text, 'completed'::text, 'failed'::text, 'cancelled'::text]));



ALTER TABLE public.automations ADD CONSTRAINT automations_pkey PRIMARY KEY (id);

ALTER TABLE public.bco_integrations ADD CONSTRAINT bco_integrations_pkey PRIMARY KEY (id);

ALTER TABLE public.bco_websites ADD CONSTRAINT bco_websites_pkey PRIMARY KEY (id);


ALTER TABLE public.booking_throttle ADD CONSTRAINT booking_throttle_pkey PRIMARY KEY (id);


ALTER TABLE public.contacts ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);

ALTER TABLE public.content_items ADD CONSTRAINT content_items_content_type_check CHECK (content_type = ANY (ARRAY['post'::text, 'reel'::text, 'story'::text, 'article'::text, 'newsletter'::text, 'ad'::text, 'other'::text]));



ALTER TABLE public.content_items ADD CONSTRAINT content_items_pkey PRIMARY KEY (id);

ALTER TABLE public.content_items ADD CONSTRAINT content_items_status_check CHECK (status = ANY (ARRAY['idea'::text, 'draft'::text, 'scheduled'::text, 'published'::text, 'archived'::text]));



ALTER TABLE public.conversations ADD CONSTRAINT conversations_organization_id_phone_key UNIQUE (organization_id, phone);

ALTER TABLE public.conversations ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);

ALTER TABLE public.conversations ADD CONSTRAINT conversations_status_check CHECK (status = ANY (ARRAY['open'::text, 'closed'::text]));

ALTER TABLE public.financial_entries ADD CONSTRAINT financial_entries_amount_check CHECK (amount >= 0::numeric);


ALTER TABLE public.financial_entries ADD CONSTRAINT financial_entries_entry_type_check CHECK (entry_type = ANY (ARRAY['income'::text, 'expense'::text]));




ALTER TABLE public.financial_entries ADD CONSTRAINT financial_entries_pkey PRIMARY KEY (id);

ALTER TABLE public.financial_entries ADD CONSTRAINT financial_entries_status_check CHECK (status = ANY (ARRAY['planned'::text, 'issued'::text, 'paid'::text, 'cancelled'::text]));


ALTER TABLE public.integration_webhook_tokens ADD CONSTRAINT integration_webhook_tokens_kind_check CHECK (kind = ANY (ARRAY['bulkgate'::text, 'missed_call'::text]));


ALTER TABLE public.integration_webhook_tokens ADD CONSTRAINT integration_webhook_tokens_organization_id_kind_key UNIQUE (organization_id, kind);

ALTER TABLE public.integration_webhook_tokens ADD CONSTRAINT integration_webhook_tokens_pkey PRIMARY KEY (id);

ALTER TABLE public.integration_webhook_tokens ADD CONSTRAINT integration_webhook_tokens_token_hash_key UNIQUE (token_hash);



ALTER TABLE public.job_assignments ADD CONSTRAINT job_assignments_pkey PRIMARY KEY (job_id, user_id);




ALTER TABLE public.job_checklist_items ADD CONSTRAINT job_checklist_items_pkey PRIMARY KEY (id);



ALTER TABLE public.job_photos ADD CONSTRAINT job_photos_phase_check CHECK (phase = ANY (ARRAY['before'::text, 'during'::text, 'after'::text]));

ALTER TABLE public.job_photos ADD CONSTRAINT job_photos_pkey PRIMARY KEY (id);



ALTER TABLE public.job_signatures ADD CONSTRAINT job_signatures_pkey PRIMARY KEY (id);



ALTER TABLE public.jobs ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);

ALTER TABLE public.jobs ADD CONSTRAINT jobs_status_check CHECK (status = ANY (ARRAY['planned'::text, 'in_progress'::text, 'done'::text, 'cancelled'::text, 'paid'::text]));



ALTER TABLE public.leads ADD CONSTRAINT leads_pkey PRIMARY KEY (id);

ALTER TABLE public.leads ADD CONSTRAINT leads_status_check CHECK (status = ANY (ARRAY['new'::text, 'contacted'::text, 'qualified'::text, 'follow_up'::text, 'offer'::text, 'approved'::text, 'job'::text, 'delivered'::text, 'invoiced'::text, 'paid'::text, 'closed'::text, 'won'::text, 'lost'::text]));


ALTER TABLE public.media_assets ADD CONSTRAINT media_assets_kind_check CHECK (kind = ANY (ARRAY['photo'::text, 'video'::text, 'graphic'::text, 'mockup'::text, 'document'::text, 'file'::text]));


ALTER TABLE public.media_assets ADD CONSTRAINT media_assets_pkey PRIMARY KEY (id);

ALTER TABLE public.media_assets ADD CONSTRAINT media_assets_status_check CHECK (status = ANY (ARRAY['processing'::text, 'ready'::text, 'archived'::text, 'failed'::text]));


ALTER TABLE public.memberships ADD CONSTRAINT memberships_pkey PRIMARY KEY (organization_id, user_id);

ALTER TABLE public.memberships ADD CONSTRAINT memberships_role_check CHECK (role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text, 'worker'::text, 'viewer'::text]));



ALTER TABLE public.merch_creative_proposals ADD CONSTRAINT merch_creative_proposals_pkey PRIMARY KEY (id);



ALTER TABLE public.merch_creative_proposals ADD CONSTRAINT merch_creative_proposals_score_check CHECK (score >= 0 AND score <= 100);

ALTER TABLE public.merch_creative_proposals ADD CONSTRAINT merch_creative_proposals_status_check CHECK (status = ANY (ARRAY['candidate'::text, 'selected'::text, 'approved'::text, 'rejected'::text, 'sent'::text]));

ALTER TABLE public.merch_order_items ADD CONSTRAINT merch_order_items_line_total_check CHECK (line_total >= 0::numeric);



ALTER TABLE public.merch_order_items ADD CONSTRAINT merch_order_items_pkey PRIMARY KEY (id);


ALTER TABLE public.merch_order_items ADD CONSTRAINT merch_order_items_quantity_check CHECK (quantity > 0::numeric);

ALTER TABLE public.merch_order_items ADD CONSTRAINT merch_order_items_unit_price_check CHECK (unit_price >= 0::numeric);




ALTER TABLE public.merch_orders ADD CONSTRAINT merch_orders_organization_id_order_number_key UNIQUE (organization_id, order_number);

ALTER TABLE public.merch_orders ADD CONSTRAINT merch_orders_pkey PRIMARY KEY (id);

ALTER TABLE public.merch_orders ADD CONSTRAINT merch_orders_shipping_check CHECK (shipping >= 0::numeric);

ALTER TABLE public.merch_orders ADD CONSTRAINT merch_orders_status_check CHECK (status = ANY (ARRAY['new'::text, 'confirmed'::text, 'paid'::text, 'production'::text, 'ready'::text, 'shipped'::text, 'delivered'::text, 'cancelled'::text, 'refunded'::text]));

ALTER TABLE public.merch_orders ADD CONSTRAINT merch_orders_subtotal_check CHECK (subtotal >= 0::numeric);

ALTER TABLE public.merch_orders ADD CONSTRAINT merch_orders_total_check CHECK (total >= 0::numeric);

ALTER TABLE public.merch_outreach_drafts ADD CONSTRAINT merch_outreach_drafts_channel_check CHECK (channel = ANY (ARRAY['email'::text, 'whatsapp'::text, 'instagram'::text, 'facebook'::text, 'other'::text]));


ALTER TABLE public.merch_outreach_drafts ADD CONSTRAINT merch_outreach_drafts_pkey PRIMARY KEY (id);


ALTER TABLE public.merch_outreach_drafts ADD CONSTRAINT merch_outreach_drafts_status_check CHECK (status = ANY (ARRAY['draft'::text, 'approved'::text, 'sent'::text, 'rejected'::text, 'cancelled'::text]));


ALTER TABLE public.merch_products ADD CONSTRAINT merch_products_organization_id_sku_key UNIQUE (organization_id, sku);

ALTER TABLE public.merch_products ADD CONSTRAINT merch_products_pkey PRIMARY KEY (id);

ALTER TABLE public.merch_products ADD CONSTRAINT merch_products_price_check CHECK (price >= 0::numeric);

ALTER TABLE public.merch_prospects ADD CONSTRAINT merch_prospects_fit_score_check CHECK (fit_score >= 0 AND fit_score <= 100);


ALTER TABLE public.merch_prospects ADD CONSTRAINT merch_prospects_pkey PRIMARY KEY (id);

ALTER TABLE public.merch_prospects ADD CONSTRAINT merch_prospects_status_check CHECK (status = ANY (ARRAY['discovered'::text, 'qualified'::text, 'draft_ready'::text, 'approved'::text, 'contacted'::text, 'replied'::text, 'converted'::text, 'rejected'::text, 'suppressed'::text]));


ALTER TABLE public.messages ADD CONSTRAINT messages_direction_check CHECK (direction = ANY (ARRAY['in'::text, 'out'::text]));


ALTER TABLE public.messages ADD CONSTRAINT messages_pkey PRIMARY KEY (id);





ALTER TABLE public.missed_calls ADD CONSTRAINT missed_calls_pkey PRIMARY KEY (id);




ALTER TABLE public.opportunities ADD CONSTRAINT opportunities_pkey PRIMARY KEY (id);

ALTER TABLE public.opportunities ADD CONSTRAINT opportunities_priority_check CHECK (priority = ANY (ARRAY['A'::text, 'B'::text, 'C'::text]));

ALTER TABLE public.opportunities ADD CONSTRAINT opportunities_probability_check CHECK (probability >= 0::numeric AND probability <= 100::numeric);

ALTER TABLE public.opportunities ADD CONSTRAINT opportunities_stage_check CHECK (stage = ANY (ARRAY['lead'::text, 'qualification'::text, 'meeting'::text, 'proposal'::text, 'negotiation'::text, 'won'::text, 'lost'::text]));

ALTER TABLE public.organizations ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);

ALTER TABLE public.organizations ADD CONSTRAINT organizations_slug_key UNIQUE (slug);

ALTER TABLE public.organizations ADD CONSTRAINT organizations_sms_daily_limit_check CHECK (sms_daily_limit >= 1 AND sms_daily_limit <= 10000);

ALTER TABLE public.organizations ADD CONSTRAINT organizations_sms_monthly_limit_check CHECK (sms_monthly_limit >= 1 AND sms_monthly_limit <= 100000);


ALTER TABLE public.quote_items ADD CONSTRAINT quote_items_pkey PRIMARY KEY (id);






ALTER TABLE public.quotes ADD CONSTRAINT quotes_organization_id_quote_number_key UNIQUE (organization_id, quote_number);

ALTER TABLE public.quotes ADD CONSTRAINT quotes_pkey PRIMARY KEY (id);

ALTER TABLE public.quotes ADD CONSTRAINT quotes_status_check CHECK (status = ANY (ARRAY['draft'::text, 'sent'::text, 'accepted'::text, 'rejected'::text, 'expired'::text]));


ALTER TABLE public.service_bookings ADD CONSTRAINT service_bookings_pkey PRIMARY KEY (id);

ALTER TABLE public.service_bookings ADD CONSTRAINT service_bookings_status_check CHECK (status = ANY (ARRAY['new'::text, 'converted'::text, 'closed'::text, 'cancelled'::text]));


ALTER TABLE public.service_catalog ADD CONSTRAINT service_catalog_pkey PRIMARY KEY (id);



ALTER TABLE public.tasks ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);

ALTER TABLE public.tasks ADD CONSTRAINT tasks_priority_check CHECK (priority = ANY (ARRAY['A'::text, 'B'::text, 'C'::text]));

ALTER TABLE public.tasks ADD CONSTRAINT tasks_status_check CHECK (status = ANY (ARRAY['open'::text, 'in_progress'::text, 'blocked'::text, 'done'::text, 'cancelled'::text]));




ALTER TABLE public.team_invites ADD CONSTRAINT team_invites_pkey PRIMARY KEY (id);

ALTER TABLE public.team_invites ADD CONSTRAINT team_invites_role_check CHECK (role = ANY (ARRAY['admin'::text, 'manager'::text, 'worker'::text, 'viewer'::text]));

ALTER TABLE public.team_invites ADD CONSTRAINT team_invites_token_hash_key UNIQUE (token_hash);

ALTER TABLE public.time_entries ADD CONSTRAINT time_entries_check CHECK (ended_at IS NULL OR ended_at >= started_at);



ALTER TABLE public.time_entries ADD CONSTRAINT time_entries_pkey PRIMARY KEY (id);


ALTER TABLE public.webhook_events ADD CONSTRAINT webhook_events_dedupe_key_key UNIQUE (dedupe_key);


ALTER TABLE public.webhook_events ADD CONSTRAINT webhook_events_pkey PRIMARY KEY (id);
ALTER TABLE public.ai_agent_events ADD CONSTRAINT ai_agent_events_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES ai_agents(id) ON DELETE SET NULL;
ALTER TABLE public.ai_agent_events ADD CONSTRAINT ai_agent_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.ai_agents ADD CONSTRAINT ai_agents_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.ai_approvals ADD CONSTRAINT ai_approvals_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES ai_agents(id) ON DELETE CASCADE;
ALTER TABLE public.ai_approvals ADD CONSTRAINT ai_approvals_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.ai_runs ADD CONSTRAINT ai_runs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.ai_runs ADD CONSTRAINT ai_runs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.app_snapshots ADD CONSTRAINT app_snapshots_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.app_snapshots ADD CONSTRAINT app_snapshots_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.automation_runs ADD CONSTRAINT automation_runs_automation_id_fkey FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE;
ALTER TABLE public.automation_runs ADD CONSTRAINT automation_runs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.automations ADD CONSTRAINT automations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.automations ADD CONSTRAINT automations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.booking_throttle ADD CONSTRAINT booking_throttle_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.contacts ADD CONSTRAINT contacts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.content_items ADD CONSTRAINT content_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.content_items ADD CONSTRAINT content_items_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.conversations ADD CONSTRAINT conversations_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE public.conversations ADD CONSTRAINT conversations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.financial_entries ADD CONSTRAINT financial_entries_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.financial_entries ADD CONSTRAINT financial_entries_job_id_fkey FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE SET NULL;
ALTER TABLE public.financial_entries ADD CONSTRAINT financial_entries_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE SET NULL;
ALTER TABLE public.financial_entries ADD CONSTRAINT financial_entries_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.integration_webhook_tokens ADD CONSTRAINT integration_webhook_tokens_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.integration_webhook_tokens ADD CONSTRAINT integration_webhook_tokens_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.job_assignments ADD CONSTRAINT job_assignments_job_id_fkey FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;
ALTER TABLE public.job_assignments ADD CONSTRAINT job_assignments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.job_assignments ADD CONSTRAINT job_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.job_checklist_items ADD CONSTRAINT job_checklist_items_job_id_fkey FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;
ALTER TABLE public.job_checklist_items ADD CONSTRAINT job_checklist_items_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.job_photos ADD CONSTRAINT job_photos_job_id_fkey FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;
ALTER TABLE public.job_photos ADD CONSTRAINT job_photos_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.job_signatures ADD CONSTRAINT job_signatures_job_id_fkey FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;
ALTER TABLE public.job_signatures ADD CONSTRAINT job_signatures_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.leads ADD CONSTRAINT leads_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE public.leads ADD CONSTRAINT leads_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.media_assets ADD CONSTRAINT media_assets_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.media_assets ADD CONSTRAINT media_assets_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.memberships ADD CONSTRAINT memberships_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.memberships ADD CONSTRAINT memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.merch_creative_proposals ADD CONSTRAINT merch_creative_proposals_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.merch_creative_proposals ADD CONSTRAINT merch_creative_proposals_product_id_fkey FOREIGN KEY (product_id) REFERENCES merch_products(id) ON DELETE SET NULL;
ALTER TABLE public.merch_creative_proposals ADD CONSTRAINT merch_creative_proposals_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES merch_prospects(id) ON DELETE SET NULL;
ALTER TABLE public.merch_order_items ADD CONSTRAINT merch_order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES merch_orders(id) ON DELETE CASCADE;
ALTER TABLE public.merch_order_items ADD CONSTRAINT merch_order_items_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.merch_order_items ADD CONSTRAINT merch_order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES merch_products(id) ON DELETE SET NULL;
ALTER TABLE public.merch_orders ADD CONSTRAINT merch_orders_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE public.merch_orders ADD CONSTRAINT merch_orders_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE public.merch_orders ADD CONSTRAINT merch_orders_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.merch_outreach_drafts ADD CONSTRAINT merch_outreach_drafts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.merch_outreach_drafts ADD CONSTRAINT merch_outreach_drafts_prospect_id_fkey FOREIGN KEY (prospect_id) REFERENCES merch_prospects(id) ON DELETE CASCADE;
ALTER TABLE public.merch_products ADD CONSTRAINT merch_products_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.merch_prospects ADD CONSTRAINT merch_prospects_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.messages ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;
ALTER TABLE public.messages ADD CONSTRAINT messages_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.missed_calls ADD CONSTRAINT missed_calls_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE public.missed_calls ADD CONSTRAINT missed_calls_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL;
ALTER TABLE public.missed_calls ADD CONSTRAINT missed_calls_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE public.missed_calls ADD CONSTRAINT missed_calls_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.opportunities ADD CONSTRAINT opportunities_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE public.opportunities ADD CONSTRAINT opportunities_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.opportunities ADD CONSTRAINT opportunities_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.quote_items ADD CONSTRAINT quote_items_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.quote_items ADD CONSTRAINT quote_items_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE;
ALTER TABLE public.quotes ADD CONSTRAINT quotes_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE public.quotes ADD CONSTRAINT quotes_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.quotes ADD CONSTRAINT quotes_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE SET NULL;
ALTER TABLE public.quotes ADD CONSTRAINT quotes_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.service_bookings ADD CONSTRAINT service_bookings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.service_catalog ADD CONSTRAINT service_catalog_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.team_invites ADD CONSTRAINT team_invites_accepted_by_fkey FOREIGN KEY (accepted_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.team_invites ADD CONSTRAINT team_invites_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.team_invites ADD CONSTRAINT team_invites_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.time_entries ADD CONSTRAINT time_entries_job_id_fkey FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;
ALTER TABLE public.time_entries ADD CONSTRAINT time_entries_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE public.time_entries ADD CONSTRAINT time_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.webhook_events ADD CONSTRAINT webhook_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION private.org_role(org uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$ select m.role from public.memberships m where m.organization_id=org and m.user_id=(select auth.uid()) limit 1 $function$;

CREATE OR REPLACE FUNCTION private.can_access_job(org uuid, job uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
  select case
    when private.org_role(org) in ('owner','admin','manager') then true
    when private.org_role(org)='worker' then exists(select 1 from public.job_assignments a where a.organization_id=org and a.job_id=job and a.user_id=(select auth.uid()))
    else false
  end
$function$;


CREATE OR REPLACE FUNCTION private.is_assigned_job(org uuid, jid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$ select exists(select 1 from public.job_assignments a where a.organization_id=org and a.job_id=jid and a.user_id=(select auth.uid())) $function$;


CREATE OR REPLACE FUNCTION private.is_org_member(org uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$ select exists(select 1 from public.memberships m where m.organization_id=org and m.user_id=(select auth.uid())) $function$;





CREATE OR REPLACE FUNCTION public.audit_business_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  row_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) else '{}'::jsonb end;
  row_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) else '{}'::jsonb end;
  org uuid;
  eid text;
  meta jsonb;
begin
  org := coalesce((row_new->>'organization_id')::uuid,(row_old->>'organization_id')::uuid);
  eid := coalesce(row_new->>'id',row_old->>'id');
  meta := jsonb_build_object(
    'table',tg_table_name,
    'operation',lower(tg_op),
    'old_status',row_old->>'status',
    'new_status',row_new->>'status',
    'title',coalesce(row_new->>'title',row_new->>'name',row_old->>'title',row_old->>'name')
  );
  insert into public.audit_log(organization_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(org,(select auth.uid()),tg_table_name||'.'||lower(tg_op),tg_table_name,eid,meta);
  return case when tg_op='DELETE' then old else new end;
end $function$;


CREATE OR REPLACE FUNCTION public.bco_dashboard_metrics(target_org_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  result jsonb;
  current_uid uuid := (select auth.uid());
begin
  if current_uid is null or not private.is_org_member(target_org_id) then
    raise exception 'not_authorized';
  end if;

  select jsonb_build_object(
    'contacts', (select count(*) from public.contacts c where c.organization_id = target_org_id),
    'leads', (select count(*) from public.leads l where l.organization_id = target_org_id and l.status not in ('won','lost','closed')),
    'opportunities', (select count(*) from public.opportunities o where o.organization_id = target_org_id and o.stage not in ('won','lost','closed')),
    'pipeline_value', coalesce((select sum(coalesce(o.value,0)) from public.opportunities o where o.organization_id = target_org_id and o.stage not in ('won','lost','closed')),0),
    'weighted_pipeline_value', coalesce((select sum(coalesce(o.value,0) * coalesce(o.probability,0) / 100) from public.opportunities o where o.organization_id = target_org_id and o.stage not in ('won','lost','closed')),0),
    'open_tasks', (select count(*) from public.tasks t where t.organization_id = target_org_id and t.status not in ('done','completed','cancelled')),
    'overdue_tasks', (select count(*) from public.tasks t where t.organization_id = target_org_id and t.status not in ('done','completed','cancelled') and t.due_at < now()),
    'active_jobs', (select count(*) from public.jobs j where j.organization_id = target_org_id and j.status not in ('completed','done','cancelled')),
    'revenue_total', coalesce((select sum(abs(f.amount)) from public.financial_entries f where f.organization_id = target_org_id and f.entry_type in ('income','revenue') and f.status not in ('cancelled','void')),0),
    'cost_total', coalesce((select sum(abs(f.amount)) from public.financial_entries f where f.organization_id = target_org_id and f.entry_type in ('expense','cost') and f.status not in ('cancelled','void')),0),
    'ai_runs', (select count(*) from public.ai_runs a where a.organization_id = target_org_id),
    'automation_runs', (select count(*) from public.automation_runs ar where ar.organization_id = target_org_id)
  ) into result;
  return result;
end;
$function$;


CREATE OR REPLACE FUNCTION public.bco_finance_metrics(target_org_id uuid, from_date date DEFAULT NULL::date, to_date date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with f as (
    select * from public.financial_entries where organization_id=target_org_id and (from_date is null or occurred_on>=from_date) and (to_date is null or occurred_on<=to_date) and status<>'cancelled'
  )
  select jsonb_build_object(
    'income', coalesce((select sum(amount) from f where entry_type='income' and status in ('issued','paid')),0),
    'expense', coalesce((select sum(amount) from f where entry_type='expense' and status in ('issued','paid')),0),
    'planned_income', coalesce((select sum(amount) from f where entry_type='income' and status='planned'),0),
    'planned_expense', coalesce((select sum(amount) from f where entry_type='expense' and status='planned'),0),
    'cash_result', coalesce((select sum(case when entry_type='income' then amount else -amount end) from f where status='paid'),0),
    'entry_count', count(*)
  ) from f;
$function$;


CREATE OR REPLACE FUNCTION public.bco_jobs_metrics(target_org_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'planned', coalesce((select count(*) from public.jobs where organization_id=target_org_id and status='planned'),0),
    'in_progress', coalesce((select count(*) from public.jobs where organization_id=target_org_id and status='in_progress'),0),
    'done', coalesce((select count(*) from public.jobs where organization_id=target_org_id and status='done'),0),
    'paid', coalesce((select count(*) from public.jobs where organization_id=target_org_id and status='paid'),0),
    'revenue', coalesce((select sum(coalesce(price,0)) from public.jobs where organization_id=target_org_id and status in ('done','paid')),0),
    'direct_cost', coalesce((select sum(coalesce(direct_cost,0)) from public.jobs where organization_id=target_org_id and status in ('done','paid')),0),
    'margin', coalesce((select sum(coalesce(price,0)-coalesce(direct_cost,0)) from public.jobs where organization_id=target_org_id and status in ('done','paid')),0)
  );
$function$;


CREATE OR REPLACE FUNCTION public.bco_sales_metrics(target_org_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'active_opportunities', coalesce((select count(*) from public.opportunities o where o.organization_id=target_org_id and o.stage not in ('won','lost')),0),
    'pipeline_value', coalesce((select sum(coalesce(o.value,0)) from public.opportunities o where o.organization_id=target_org_id and o.stage not in ('won','lost')),0),
    'weighted_pipeline_value', coalesce((select sum(coalesce(o.value,0)*coalesce(o.probability,0)/100.0) from public.opportunities o where o.organization_id=target_org_id and o.stage not in ('won','lost')),0),
    'won_value', coalesce((select sum(coalesce(o.value,0)) from public.opportunities o where o.organization_id=target_org_id and o.stage='won'),0),
    'lost_value', coalesce((select sum(coalesce(o.value,0)) from public.opportunities o where o.organization_id=target_org_id and o.stage='lost'),0),
    'high_priority', coalesce((select count(*) from public.opportunities o where o.organization_id=target_org_id and o.priority='A' and o.stage not in ('won','lost')),0)
  );
$function$;


CREATE OR REPLACE FUNCTION public.claim_team_invite(invite_token text)
 RETURNS TABLE(organization_id uuid, organization_name text, assigned_role text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare
  uid uuid := (select auth.uid());
  user_email text;
  h text := encode(digest(trim(invite_token),'sha256'),'hex');
  inv public.team_invites;
  org_name text;
begin
  if uid is null then raise exception 'authentication_required'; end if;
  select lower(email) into user_email from auth.users where id=uid;
  select * into inv from public.team_invites where token_hash=h and accepted_at is null and expires_at>now() limit 1 for update;
  if inv.id is null then raise exception 'invalid_or_expired_invite'; end if;
  if lower(inv.email)<>user_email then raise exception 'invite_email_mismatch'; end if;
  insert into public.memberships(organization_id,user_id,role)
  values(inv.organization_id,uid,inv.role)
  on conflict (organization_id,user_id) do update set role=excluded.role;
  update public.team_invites set accepted_at=now(),accepted_by=uid where id=inv.id;
  select name into org_name from public.organizations where id=inv.organization_id;
  insert into public.audit_log(organization_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(inv.organization_id,uid,'team.invite_accepted','membership',uid::text,jsonb_build_object('role',inv.role));
  return query select inv.organization_id, org_name, inv.role;
end $function$;


CREATE OR REPLACE FUNCTION public.create_my_organization(org_name text, org_slug text DEFAULT NULL::text)
 RETURNS organizations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  uid uuid := (select auth.uid());
  result public.organizations;
  clean_name text := nullif(trim(org_name),'');
  clean_slug text := nullif(lower(regexp_replace(coalesce(org_slug,''),'[^a-zA-Z0-9-]+','-','g')),'');
  owned_count integer;
begin
  if uid is null then raise exception 'authentication_required'; end if;
  if clean_name is null or length(clean_name)>120 then raise exception 'invalid_organization_name'; end if;
  select count(*)::int into owned_count from public.memberships where user_id=uid and role='owner';
  if owned_count >= 10 then raise exception 'organization_limit_reached'; end if;
  if clean_slug is not null and (length(clean_slug)<3 or length(clean_slug)>80) then raise exception 'invalid_slug'; end if;
  insert into public.organizations(name,slug) values(clean_name,clean_slug) returning * into result;
  insert into public.memberships(organization_id,user_id,role) values(result.id,uid,'owner');
  insert into public.audit_log(organization_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(result.id,uid,'organization.created','organization',result.id::text,jsonb_build_object('name',result.name));
  return result;
end $function$;


CREATE OR REPLACE FUNCTION public.create_team_invite(org_id uuid, invite_email text, invite_role text DEFAULT 'worker'::text)
 RETURNS TABLE(invite_id uuid, token text, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth', 'pg_temp'
AS $function$
declare
  uid uuid := (select auth.uid());
  clean_email text := lower(trim(invite_email));
  raw_token text := encode(gen_random_bytes(32),'hex');
  h text := encode(digest(raw_token,'sha256'),'hex');
  iid uuid;
  exp timestamptz := now() + interval '7 days';
begin
  if uid is null then raise exception 'authentication_required'; end if;
  if coalesce(private.org_role(org_id),'') not in ('owner','admin') then raise exception 'not_allowed'; end if;
  if clean_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'invalid_email'; end if;
  if invite_role not in ('admin','manager','worker','viewer') then raise exception 'invalid_role'; end if;
  if exists(select 1 from public.memberships m join auth.users u on u.id=m.user_id where m.organization_id=org_id and lower(u.email)=clean_email) then
    raise exception 'already_member';
  end if;
  delete from public.team_invites where organization_id=org_id and lower(email)=clean_email and accepted_at is null;
  insert into public.team_invites(organization_id,email,role,token_hash,created_by,expires_at)
  values(org_id,clean_email,invite_role,h,uid,exp) returning id into iid;
  insert into public.audit_log(organization_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(org_id,uid,'team.invite_created','team_invite',iid::text,jsonb_build_object('email',clean_email,'role',invite_role));
  return query select iid, raw_token, exp;
end
$function$;


CREATE OR REPLACE FUNCTION public.disable_integration_webhook(org_id uuid, webhook_kind text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare uid uuid := (select auth.uid()); n integer;
begin
  if uid is null then raise exception 'authentication_required'; end if;
  if coalesce(private.org_role(org_id),'') not in ('owner','admin') then raise exception 'not_allowed'; end if;
  delete from public.integration_webhook_tokens where organization_id=org_id and kind=webhook_kind;
  get diagnostics n = row_count;
  insert into public.audit_log(organization_id,actor_user_id,action,entity_type,metadata)
  values(org_id,uid,'integration.webhook_disabled','integration',jsonb_build_object('kind',webhook_kind));
  return n>0;
end
$function$;


CREATE OR REPLACE FUNCTION public.list_org_members(org_id uuid)
 RETURNS TABLE(user_id uuid, email text, role text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth', 'pg_temp'
AS $function$
begin
  if (select auth.uid()) is null then raise exception 'authentication_required'; end if;
  if coalesce(private.org_role(org_id),'') not in ('owner','admin','manager') then raise exception 'not_allowed'; end if;
  return query
    select m.user_id, u.email::text, m.role, m.created_at
    from public.memberships m join auth.users u on u.id=m.user_id
    where m.organization_id=org_id
    order by case m.role when 'owner' then 1 when 'admin' then 2 when 'manager' then 3 when 'worker' then 4 else 5 end, m.created_at;
end
$function$;


CREATE OR REPLACE FUNCTION public.maintenance_cleanup()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  delete from public.booking_throttle where created_at < now() - interval '2 days';
  delete from public.webhook_events where created_at < now() - interval '90 days';
  delete from public.team_invites where accepted_at is null and expires_at < now() - interval '30 days';
  delete from public.team_invites where accepted_at is not null and accepted_at < now() - interval '90 days';
end $function$;


CREATE OR REPLACE FUNCTION public.quote_items_recalculate_totals()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_quote_totals(old.quote_id);
    return old;
  end if;
  perform public.recalculate_quote_totals(new.quote_id);
  if tg_op = 'UPDATE' and old.quote_id <> new.quote_id then
    perform public.recalculate_quote_totals(old.quote_id);
  end if;
  return new;
end;
$function$;


CREATE OR REPLACE FUNCTION public.recalculate_quote_totals(target_quote_id uuid)
 RETURNS quotes
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  q public.quotes;
  subtotal_value numeric := 0;
  tax_value numeric := 0;
begin
  if not exists (select 1 from public.quotes where id = target_quote_id) then
    raise exception 'quote_not_found';
  end if;
  select coalesce(sum(quantity * unit_price),0),
         coalesce(sum(quantity * unit_price * tax_rate / 100),0)
    into subtotal_value, tax_value
  from public.quote_items
  where quote_id = target_quote_id;
  update public.quotes
     set subtotal = round(subtotal_value,2),
         tax = round(tax_value,2),
         total = round(subtotal_value + tax_value,2),
         updated_at = now()
   where id = target_quote_id
   returning * into q;
  return q;
end;
$function$;


CREATE OR REPLACE FUNCTION public.remove_org_member(org_id uuid, member_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  actor uuid := (select auth.uid());
  member_role text;
begin
  if actor is null then raise exception 'authentication_required'; end if;
  if coalesce(private.org_role(org_id),'') not in ('owner','admin') then raise exception 'not_allowed'; end if;
  select role into member_role from public.memberships where organization_id=org_id and user_id=member_user_id;
  if member_role is null then raise exception 'member_not_found'; end if;
  if member_role='owner' then raise exception 'owner_cannot_be_removed'; end if;
  delete from public.memberships where organization_id=org_id and user_id=member_user_id;
  insert into public.audit_log(organization_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(org_id,actor,'team.member_removed','membership',member_user_id::text,jsonb_build_object('role',member_role));
end
$function$;


CREATE OR REPLACE FUNCTION public.rotate_integration_webhook(org_id uuid, webhook_kind text)
 RETURNS TABLE(token text, kind text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  uid uuid := (select auth.uid());
  raw_token text;
  h text;
  ts timestamptz := now();
begin
  if uid is null then raise exception 'authentication_required'; end if;
  if coalesce(private.org_role(org_id),'') not in ('owner','admin') then raise exception 'not_allowed'; end if;
  if webhook_kind not in ('bulkgate','missed_call') then raise exception 'invalid_webhook_kind'; end if;
  raw_token := encode(gen_random_bytes(32),'hex');
  h := encode(digest(raw_token,'sha256'),'hex');
  insert into public.integration_webhook_tokens(organization_id,kind,token_hash,created_by,created_at)
  values(org_id,webhook_kind,h,uid,ts)
  on conflict (organization_id,kind)
  do update set token_hash=excluded.token_hash,created_by=excluded.created_by,created_at=excluded.created_at;
  insert into public.audit_log(organization_id,actor_user_id,action,entity_type,metadata)
  values(org_id,uid,'integration.webhook_rotated','integration',jsonb_build_object('kind',webhook_kind));
  return query select raw_token, webhook_kind, ts;
end
$function$;


CREATE OR REPLACE FUNCTION public.set_merch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$ begin new.updated_at = now(); return new; end $function$;


CREATE OR REPLACE FUNCTION public.set_my_organization_slug(new_slug text)
 RETURNS organizations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  uid uuid := (select auth.uid());
  org uuid;
  clean text := nullif(lower(regexp_replace(coalesce(new_slug,''),'[^a-zA-Z0-9-]+','-','g')),'');
  result public.organizations;
begin
  if uid is null then raise exception 'authentication_required'; end if;
  select organization_id into org from public.memberships where user_id=uid and role in ('owner','admin') order by created_at asc limit 1;
  if org is null then raise exception 'organization_not_found'; end if;
  if clean is null or length(clean)<3 or length(clean)>80 then raise exception 'invalid_slug'; end if;
  update public.organizations set slug=clean where id=org returning * into result;
  return result;
end $function$;


CREATE OR REPLACE FUNCTION public.start_job_timer(target_job_id uuid)
 RETURNS time_entries
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  uid uuid := (select auth.uid());
  org uuid;
  r public.time_entries;
begin
  if uid is null then raise exception 'authentication_required'; end if;
  select organization_id into org from public.jobs where id=target_job_id;
  if org is null then raise exception 'job_not_found'; end if;
  if not private.can_access_job(org,target_job_id) then raise exception 'not_allowed'; end if;
  if exists(select 1 from public.time_entries where user_id=uid and ended_at is null) then raise exception 'timer_already_running'; end if;
  insert into public.time_entries(organization_id,job_id,user_id) values(org,target_job_id,uid) returning * into r;
  update public.jobs set status=case when status='planned' then 'in_progress' else status end where id=target_job_id;
  insert into public.audit_log(organization_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(org,uid,'time.started','job',target_job_id::text,jsonb_build_object('time_entry_id',r.id));
  return r;
end $function$;


CREATE OR REPLACE FUNCTION public.stop_job_timer(entry_id uuid)
 RETURNS time_entries
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  uid uuid := (select auth.uid());
  r public.time_entries;
  r_role text;
begin
  if uid is null then raise exception 'authentication_required'; end if;
  select * into r from public.time_entries where id=entry_id;
  if r.id is null then raise exception 'time_entry_not_found'; end if;
  r_role := private.org_role(r.organization_id);
  if r.user_id<>uid and coalesce(r_role,'') not in ('owner','admin','manager') then raise exception 'not_allowed'; end if;
  if r.ended_at is not null then return r; end if;
  update public.time_entries set ended_at=now() where id=entry_id returning * into r;
  insert into public.audit_log(organization_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(r.organization_id,uid,'time.stopped','job',r.job_id::text,jsonb_build_object('time_entry_id',r.id,'minutes',round(extract(epoch from (r.ended_at-r.started_at))/60)));
  return r;
end
$function$;


CREATE OR REPLACE FUNCTION public.touch_ai_agents_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;


CREATE OR REPLACE FUNCTION public.touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin new.updated_at=now(); return new; end $function$;


CREATE OR REPLACE FUNCTION public.update_my_organization_profile(org_id uuid, new_name text, new_slug text, new_phone text DEFAULT NULL::text, new_email text DEFAULT NULL::text, new_address text DEFAULT NULL::text, new_ico text DEFAULT NULL::text)
 RETURNS organizations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare r public.organizations;
begin
  if (select auth.uid()) is null then raise exception 'authentication_required'; end if;
  if coalesce(private.org_role(org_id),'') not in ('owner','admin') then raise exception 'not_allowed'; end if;
  if length(trim(new_name)) < 2 then raise exception 'invalid_name'; end if;
  if new_slug is not null and new_slug !~ '^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$' then raise exception 'invalid_slug'; end if;
  update public.organizations
    set name=trim(new_name),
        slug=lower(trim(new_slug)),
        phone=nullif(trim(new_phone),''),
        email=nullif(lower(trim(new_email)),''),
        address=nullif(trim(new_address),''),
        ico=nullif(trim(new_ico),'')
    where id=org_id
    returning * into r;
  return r;
end
$function$;


CREATE OR REPLACE FUNCTION public.update_org_integration_settings(org_id uuid, new_booking_enabled boolean, new_booking_intro text, new_sms_enabled boolean, new_sms_provider text, new_sms_sender text, new_missed_call_template text)
 RETURNS organizations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare r public.organizations;
begin
  if (select auth.uid()) is null then raise exception 'authentication_required'; end if;
  if coalesce(private.org_role(org_id),'') not in ('owner','admin') then raise exception 'not_allowed'; end if;
  if new_sms_provider not in ('bulkgate') then raise exception 'unsupported_sms_provider'; end if;
  if length(coalesce(new_missed_call_template,''))>600 then raise exception 'template_too_long'; end if;
  update public.organizations set
    booking_enabled=coalesce(new_booking_enabled,true),
    booking_intro=nullif(trim(new_booking_intro),''),
    sms_enabled=coalesce(new_sms_enabled,false),
    sms_provider=new_sms_provider,
    sms_sender=nullif(trim(new_sms_sender),''),
    missed_call_template=coalesce(nullif(trim(new_missed_call_template),''),missed_call_template)
  where id=org_id returning * into r;
  insert into public.audit_log(organization_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(org_id,(select auth.uid()),'organization.integrations_updated','organization',org_id::text,jsonb_build_object('sms_enabled',r.sms_enabled,'booking_enabled',r.booking_enabled));
  return r;
end
$function$;


CREATE OR REPLACE FUNCTION public.update_org_member_role(org_id uuid, member_user_id uuid, new_role text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  actor uuid := (select auth.uid());
  old_role text;
begin
  if actor is null then raise exception 'authentication_required'; end if;
  if coalesce(private.org_role(org_id),'') not in ('owner','admin') then raise exception 'not_allowed'; end if;
  if new_role not in ('admin','manager','worker','viewer') then raise exception 'invalid_role'; end if;
  select role into old_role from public.memberships where organization_id=org_id and user_id=member_user_id;
  if old_role is null then raise exception 'member_not_found'; end if;
  if old_role='owner' then raise exception 'owner_role_protected'; end if;
  update public.memberships set role=new_role where organization_id=org_id and user_id=member_user_id;
  insert into public.audit_log(organization_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(org_id,actor,'team.role_changed','membership',member_user_id::text,jsonb_build_object('from',old_role,'to',new_role));
end
$function$;


CREATE OR REPLACE FUNCTION public.update_org_sms_limits(org_id uuid, new_daily_limit integer, new_monthly_limit integer)
 RETURNS organizations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare r public.organizations;
begin
  if (select auth.uid()) is null then raise exception 'authentication_required'; end if;
  if coalesce(private.org_role(org_id),'') not in ('owner','admin') then raise exception 'not_allowed'; end if;
  if new_daily_limit < 1 or new_daily_limit > 10000 then raise exception 'invalid_sms_daily_limit'; end if;
  if new_monthly_limit < new_daily_limit or new_monthly_limit > 100000 then raise exception 'invalid_sms_monthly_limit'; end if;
  update public.organizations set sms_daily_limit=new_daily_limit,sms_monthly_limit=new_monthly_limit where id=org_id returning * into r;
  insert into public.audit_log(organization_id,actor_user_id,action,entity_type,metadata)
  values(org_id,(select auth.uid()),'sms.limits_updated','organization',jsonb_build_object('daily',new_daily_limit,'monthly',new_monthly_limit));
  return r;
end
$function$;


CREATE OR REPLACE VIEW public.lead_followup_queue WITH (security_invoker=true) AS  SELECT l.id AS lead_id,
    l.organization_id,
    l.contact_id,
    c.name AS contact_name,
    c.phone AS contact_phone,
    c.email AS contact_email,
    l.source,
    l.status,
    l.estimated_value,
    l.note,
    l.created_at,
    l.updated_at,
    l.last_contact_at,
    l.next_action_at,
        CASE
            WHEN l.next_action_at IS NULL THEN 'missing_next_action'::text
            WHEN l.next_action_at <= now() THEN 'overdue'::text
            WHEN l.next_action_at <= (now() + '24:00:00'::interval) THEN 'due_24h'::text
            ELSE 'scheduled'::text
        END AS followup_state,
        CASE
            WHEN l.next_action_at IS NULL THEN NULL::integer
            WHEN l.next_action_at >= now() THEN 0
            ELSE floor(EXTRACT(epoch FROM now() - l.next_action_at) / 86400::numeric)::integer
        END AS days_overdue,
        CASE
            WHEN l.next_action_at IS NOT NULL AND l.next_action_at <= now() THEN 80
            WHEN l.next_action_at IS NULL THEN 70
            WHEN l.next_action_at <= (now() + '24:00:00'::interval) THEN 60
            ELSE 30
        END +
        CASE
            WHEN l.status = 'new'::text THEN 10
            ELSE 0
        END +
        CASE
            WHEN l.last_contact_at IS NULL THEN 5
            ELSE 0
        END +
        CASE
            WHEN COALESCE(l.estimated_value, 0::numeric) > 0::numeric THEN 5
            ELSE 0
        END AS priority_score
   FROM leads l
     LEFT JOIN contacts c ON c.id = l.contact_id AND c.organization_id = l.organization_id
  WHERE l.status = ANY (ARRAY['new'::text, 'contacted'::text]);;

CREATE INDEX ai_agent_events_agent_id_idx ON public.ai_agent_events USING btree (agent_id);

CREATE INDEX ai_agent_events_org_created_idx ON public.ai_agent_events USING btree (organization_id, created_at DESC);

CREATE INDEX ai_agents_org_active_idx ON public.ai_agents USING btree (organization_id, active);

CREATE INDEX ai_approvals_agent_id_idx ON public.ai_approvals USING btree (agent_id);

CREATE INDEX ai_approvals_org_status_idx ON public.ai_approvals USING btree (organization_id, status, requested_at DESC);

CREATE INDEX ai_runs_org_created_idx ON public.ai_runs USING btree (organization_id, created_at DESC);

CREATE INDEX ai_runs_user_idx ON public.ai_runs USING btree (user_id);

CREATE INDEX app_snapshots_org_user_idx ON public.app_snapshots USING btree (organization_id, user_id);

CREATE INDEX app_snapshots_user_id_idx ON public.app_snapshots USING btree (user_id);

CREATE INDEX audit_actor_idx ON public.audit_log USING btree (actor_user_id);

CREATE INDEX audit_log_org_created_idx ON public.audit_log USING btree (organization_id, created_at DESC);

CREATE INDEX automation_runs_automation_idx ON public.automation_runs USING btree (automation_id, started_at DESC);

CREATE INDEX automation_runs_org_idx ON public.automation_runs USING btree (organization_id);

CREATE INDEX automations_created_by_idx ON public.automations USING btree (created_by);

CREATE INDEX automations_org_active_idx ON public.automations USING btree (organization_id, active);

CREATE INDEX booking_throttle_ip_created_idx ON public.booking_throttle USING btree (ip_hash, created_at DESC);

CREATE INDEX booking_throttle_org_created_idx ON public.booking_throttle USING btree (organization_id, created_at DESC);

CREATE INDEX checklist_job_idx ON public.job_checklist_items USING btree (job_id);

CREATE INDEX checklist_org_idx ON public.job_checklist_items USING btree (organization_id);

CREATE INDEX contacts_org_email_idx ON public.contacts USING btree (organization_id, email);

CREATE INDEX contacts_org_phone_idx ON public.contacts USING btree (organization_id, phone);

CREATE INDEX contacts_org_phone_normalized_idx ON public.contacts USING btree (organization_id, phone_normalized);

CREATE INDEX content_items_created_by_idx ON public.content_items USING btree (created_by);

CREATE INDEX content_items_org_schedule_idx ON public.content_items USING btree (organization_id, scheduled_at);

CREATE INDEX conversations_contact_idx ON public.conversations USING btree (contact_id);

CREATE INDEX financial_entries_created_by_idx ON public.financial_entries USING btree (created_by);

CREATE INDEX financial_entries_job_idx ON public.financial_entries USING btree (job_id);

CREATE INDEX financial_entries_opportunity_idx ON public.financial_entries USING btree (opportunity_id);

CREATE INDEX financial_entries_org_date_idx ON public.financial_entries USING btree (organization_id, occurred_on DESC);

CREATE INDEX idx_bco_integrations_org ON public.bco_integrations USING btree (organization_id);

CREATE INDEX idx_bco_websites_org ON public.bco_websites USING btree (organization_id);

CREATE INDEX integration_webhook_tokens_created_by_idx ON public.integration_webhook_tokens USING btree (created_by);

CREATE INDEX integration_webhook_tokens_org_idx ON public.integration_webhook_tokens USING btree (organization_id);

CREATE INDEX job_assignments_org_idx ON public.job_assignments USING btree (organization_id);

CREATE INDEX job_assignments_user_idx ON public.job_assignments USING btree (user_id);

CREATE INDEX job_photos_job_idx ON public.job_photos USING btree (job_id);

CREATE INDEX job_photos_org_idx ON public.job_photos USING btree (organization_id);

CREATE INDEX job_signatures_job_idx ON public.job_signatures USING btree (job_id);

CREATE INDEX job_signatures_org_idx ON public.job_signatures USING btree (organization_id);

CREATE INDEX jobs_contact_idx ON public.jobs USING btree (contact_id);

CREATE INDEX jobs_org_scheduled_idx ON public.jobs USING btree (organization_id, scheduled_at);

CREATE INDEX jobs_org_status_idx ON public.jobs USING btree (organization_id, status);

CREATE INDEX leads_contact_idx ON public.leads USING btree (contact_id);

CREATE INDEX leads_org_next_action_idx ON public.leads USING btree (organization_id, next_action_at) WHERE (next_action_at IS NOT NULL);

CREATE INDEX leads_org_status_idx ON public.leads USING btree (organization_id, status);

CREATE INDEX media_assets_created_by_idx ON public.media_assets USING btree (created_by);

CREATE INDEX media_assets_org_kind_idx ON public.media_assets USING btree (organization_id, kind);

CREATE INDEX memberships_user_idx ON public.memberships USING btree (user_id);

CREATE INDEX merch_creative_proposals_batch_idx ON public.merch_creative_proposals USING btree (organization_id, prospect_id, created_at DESC);

CREATE INDEX merch_creative_proposals_product_idx ON public.merch_creative_proposals USING btree (product_id);

CREATE INDEX merch_creative_proposals_prospect_idx ON public.merch_creative_proposals USING btree (prospect_id);

CREATE INDEX merch_order_items_order_idx ON public.merch_order_items USING btree (order_id);

CREATE INDEX merch_order_items_organization_idx ON public.merch_order_items USING btree (organization_id);

CREATE INDEX merch_order_items_product_idx ON public.merch_order_items USING btree (product_id);

CREATE INDEX merch_orders_contact_idx ON public.merch_orders USING btree (contact_id, created_at DESC);

CREATE INDEX merch_orders_lead_idx ON public.merch_orders USING btree (lead_id);

CREATE INDEX merch_orders_org_status_idx ON public.merch_orders USING btree (organization_id, status, created_at DESC);

CREATE INDEX merch_outreach_drafts_prospect_idx ON public.merch_outreach_drafts USING btree (prospect_id);

CREATE INDEX merch_outreach_status_idx ON public.merch_outreach_drafts USING btree (organization_id, status, created_at DESC);

CREATE INDEX merch_products_org_active_idx ON public.merch_products USING btree (organization_id, active);

CREATE INDEX merch_prospects_status_idx ON public.merch_prospects USING btree (organization_id, status, fit_score DESC, created_at DESC);

CREATE INDEX messages_conversation_created_idx ON public.messages USING btree (conversation_id, created_at);

CREATE INDEX messages_org_idx ON public.messages USING btree (organization_id);

CREATE INDEX missed_calls_contact_idx ON public.missed_calls USING btree (contact_id);

CREATE INDEX missed_calls_conversation_idx ON public.missed_calls USING btree (conversation_id);

CREATE INDEX missed_calls_lead_idx ON public.missed_calls USING btree (lead_id);

CREATE INDEX missed_calls_org_occurred_idx ON public.missed_calls USING btree (organization_id, occurred_at DESC);

CREATE INDEX opportunities_contact_idx ON public.opportunities USING btree (contact_id);

CREATE INDEX opportunities_org_next_action_idx ON public.opportunities USING btree (organization_id, next_action_at);

CREATE INDEX opportunities_org_stage_idx ON public.opportunities USING btree (organization_id, stage);

CREATE INDEX opportunities_owner_idx ON public.opportunities USING btree (owner_user_id);

CREATE INDEX quote_items_org_idx ON public.quote_items USING btree (organization_id);

CREATE INDEX quote_items_quote_idx ON public.quote_items USING btree (quote_id);

CREATE INDEX quotes_contact_idx ON public.quotes USING btree (contact_id);

CREATE INDEX quotes_created_by_idx ON public.quotes USING btree (created_by);

CREATE INDEX quotes_opportunity_idx ON public.quotes USING btree (opportunity_id);

CREATE INDEX quotes_org_status_idx ON public.quotes USING btree (organization_id, status);

CREATE INDEX service_bookings_org_status_idx ON public.service_bookings USING btree (organization_id, status);

CREATE INDEX service_catalog_org_idx ON public.service_catalog USING btree (organization_id, active, sort_order);

CREATE INDEX tasks_assigned_to_idx ON public.tasks USING btree (assigned_to);

CREATE INDEX tasks_org_due_idx ON public.tasks USING btree (organization_id, due_at);

CREATE INDEX team_invites_accepted_by_idx ON public.team_invites USING btree (accepted_by) WHERE (accepted_by IS NOT NULL);

CREATE INDEX team_invites_created_by_idx ON public.team_invites USING btree (created_by);

CREATE INDEX team_invites_email_idx ON public.team_invites USING btree (lower(email));

CREATE INDEX team_invites_org_idx ON public.team_invites USING btree (organization_id, created_at DESC);

CREATE INDEX time_entries_job_idx ON public.time_entries USING btree (job_id, started_at DESC);

CREATE INDEX time_entries_org_idx ON public.time_entries USING btree (organization_id, started_at DESC);

CREATE INDEX time_entries_user_open_idx ON public.time_entries USING btree (user_id) WHERE (ended_at IS NULL);

CREATE INDEX webhook_events_org_idx ON public.webhook_events USING btree (organization_id);

CREATE UNIQUE INDEX merch_prospects_org_email_exact_all_uq ON public.merch_prospects USING btree (organization_id, email);

CREATE UNIQUE INDEX merch_prospects_org_email_exact_uq ON public.merch_prospects USING btree (organization_id, email) WHERE ((email IS NOT NULL) AND (email <> ''::text));

CREATE UNIQUE INDEX merch_prospects_org_email_uq ON public.merch_prospects USING btree (organization_id, lower(email)) WHERE ((email IS NOT NULL) AND (email <> ''::text));

CREATE UNIQUE INDEX missed_calls_org_provider_event_uidx ON public.missed_calls USING btree (organization_id, provider_event_id) WHERE (provider_event_id IS NOT NULL);

CREATE TRIGGER audit_bookings_change AFTER DELETE OR UPDATE ON service_bookings FOR EACH ROW EXECUTE FUNCTION audit_business_change();

CREATE TRIGGER audit_jobs_change AFTER INSERT OR DELETE OR UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION audit_business_change();

CREATE TRIGGER audit_leads_change AFTER INSERT OR DELETE OR UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION audit_business_change();

CREATE TRIGGER audit_service_catalog_change AFTER INSERT OR DELETE OR UPDATE ON service_catalog FOR EACH ROW EXECUTE FUNCTION audit_business_change();

CREATE TRIGGER automations_updated_at BEFORE UPDATE ON automations FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER contacts_touch BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER content_items_updated_at BEFORE UPDATE ON content_items FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER conversations_touch BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER financial_entries_updated_at BEFORE UPDATE ON financial_entries FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER jobs_touch BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER leads_touch BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER media_assets_updated_at BEFORE UPDATE ON media_assets FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER merch_orders_updated_at BEFORE UPDATE ON merch_orders FOR EACH ROW EXECUTE FUNCTION set_merch_updated_at();

CREATE TRIGGER merch_products_updated_at BEFORE UPDATE ON merch_products FOR EACH ROW EXECUTE FUNCTION set_merch_updated_at();

CREATE TRIGGER opportunities_updated_at BEFORE UPDATE ON opportunities FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER quote_items_recalculate_totals AFTER INSERT OR DELETE OR UPDATE ON quote_items FOR EACH ROW EXECUTE FUNCTION quote_items_recalculate_totals();

CREATE TRIGGER quotes_updated_at BEFORE UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER service_catalog_touch BEFORE UPDATE ON service_catalog FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_ai_agents_updated_at BEFORE UPDATE ON ai_agents FOR EACH ROW EXECUTE FUNCTION touch_ai_agents_updated_at();

ALTER TABLE public.ai_agent_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_approvals ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_runs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.app_snapshots ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.bco_integrations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.bco_websites ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.booking_throttle ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.integration_webhook_tokens ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.job_assignments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.job_checklist_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.job_photos ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.job_signatures ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.merch_creative_proposals ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.merch_order_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.merch_orders ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.merch_outreach_drafts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.merch_products ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.merch_prospects ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.missed_calls ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.service_bookings ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_agent_events_select ON public.ai_agent_events AS permissive FOR SELECT TO authenticated USING ((private.org_role(organization_id) IS NOT NULL));

CREATE POLICY ai_agents_delete ON public.ai_agents AS permissive FOR DELETE TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text])));

CREATE POLICY ai_agents_insert ON public.ai_agents AS permissive FOR INSERT TO authenticated WITH CHECK ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])));

CREATE POLICY ai_agents_select ON public.ai_agents AS permissive FOR SELECT TO authenticated USING ((private.org_role(organization_id) IS NOT NULL));

CREATE POLICY ai_agents_update ON public.ai_agents AS permissive FOR UPDATE TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text]))) WITH CHECK ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])));

CREATE POLICY ai_approvals_insert ON public.ai_approvals AS permissive FOR INSERT TO authenticated WITH CHECK ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])));

CREATE POLICY ai_approvals_select ON public.ai_approvals AS permissive FOR SELECT TO authenticated USING ((private.org_role(organization_id) IS NOT NULL));

CREATE POLICY ai_approvals_update ON public.ai_approvals AS permissive FOR UPDATE TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text]))) WITH CHECK ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])));

CREATE POLICY ai_runs_insert ON public.ai_runs AS permissive FOR INSERT TO authenticated WITH CHECK (((private.org_role(organization_id) IS NOT NULL) AND ((user_id IS NULL) OR (user_id = ( SELECT auth.uid() AS uid)))));

CREATE POLICY ai_runs_select ON public.ai_runs AS permissive FOR SELECT TO authenticated USING ((private.org_role(organization_id) IS NOT NULL));

CREATE POLICY app_snapshots_insert ON public.app_snapshots AS permissive FOR INSERT TO authenticated WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND private.is_org_member(organization_id)));

CREATE POLICY app_snapshots_select ON public.app_snapshots AS permissive FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) AND private.is_org_member(organization_id)));

CREATE POLICY app_snapshots_update ON public.app_snapshots AS permissive FOR UPDATE TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) AND private.is_org_member(organization_id))) WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND private.is_org_member(organization_id)));

CREATE POLICY assignments_delete ON public.job_assignments AS permissive FOR DELETE TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])));

CREATE POLICY assignments_insert ON public.job_assignments AS permissive FOR INSERT TO authenticated WITH CHECK ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])));

CREATE POLICY assignments_select ON public.job_assignments AS permissive FOR SELECT TO authenticated USING (((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text, 'viewer'::text])) OR (user_id = ( SELECT auth.uid() AS uid))));

CREATE POLICY assignments_update ON public.job_assignments AS permissive FOR UPDATE TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text]))) WITH CHECK ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])));

CREATE POLICY audit_select ON public.audit_log AS permissive FOR SELECT TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text])));

CREATE POLICY automation_runs_insert ON public.automation_runs AS permissive FOR INSERT TO authenticated WITH CHECK ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])));

CREATE POLICY automation_runs_select ON public.automation_runs AS permissive FOR SELECT TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])));

CREATE POLICY automations_delete ON public.automations AS permissive FOR DELETE TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text])));

CREATE POLICY automations_insert ON public.automations AS permissive FOR INSERT TO authenticated WITH CHECK ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])));

CREATE POLICY automations_select ON public.automations AS permissive FOR SELECT TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])));

CREATE POLICY automations_update ON public.automations AS permissive FOR UPDATE TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text]))) WITH CHECK ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])));

CREATE POLICY bco_integrations_delete ON public.bco_integrations AS permissive FOR DELETE TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text])));

CREATE POLICY bco_integrations_insert ON public.bco_integrations AS permissive FOR INSERT TO authenticated WITH CHECK ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text])));

CREATE POLICY bco_integrations_select ON public.bco_integrations AS permissive FOR SELECT TO authenticated USING (private.is_org_member(organization_id));

CREATE POLICY bco_integrations_update ON public.bco_integrations AS permissive FOR UPDATE TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text]))) WITH CHECK ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text])));

CREATE POLICY bco_websites_delete ON public.bco_websites AS permissive FOR DELETE TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text])));

CREATE POLICY bco_websites_insert ON public.bco_websites AS permissive FOR INSERT TO authenticated WITH CHECK ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text])));

CREATE POLICY bco_websites_select ON public.bco_websites AS permissive FOR SELECT TO authenticated USING (private.is_org_member(organization_id));

CREATE POLICY bco_websites_update ON public.bco_websites AS permissive FOR UPDATE TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text]))) WITH CHECK ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text])));

CREATE POLICY bookings_delete ON public.service_bookings AS permissive FOR DELETE TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text])));

CREATE POLICY bookings_insert ON public.service_bookings AS permissive FOR INSERT TO authenticated WITH CHECK ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])));

CREATE POLICY bookings_select ON public.service_bookings AS permissive FOR SELECT TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text, 'viewer'::text])));

CREATE POLICY bookings_update ON public.service_bookings AS permissive FOR UPDATE TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text]))) WITH CHECK ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])));

CREATE POLICY checklist_delete ON public.job_checklist_items AS permissive FOR DELETE TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])));

CREATE POLICY checklist_insert ON public.job_checklist_items AS permissive FOR INSERT TO authenticated WITH CHECK (((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])) OR private.is_assigned_job(organization_id, job_id)));

CREATE POLICY checklist_select ON public.job_checklist_items AS permissive FOR SELECT TO authenticated USING (((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text, 'viewer'::text])) OR private.is_assigned_job(organization_id, job_id)));

CREATE POLICY checklist_update ON public.job_checklist_items AS permissive FOR UPDATE TO authenticated USING (((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])) OR private.is_assigned_job(organization_id, job_id))) WITH CHECK (((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])) OR private.is_assigned_job(organization_id, job_id)));

CREATE POLICY contacts_delete ON public.contacts AS permissive FOR DELETE TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text])));

CREATE POLICY contacts_insert ON public.contacts AS permissive FOR INSERT TO authenticated WITH CHECK ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])));

CREATE POLICY contacts_select ON public.contacts AS permissive FOR SELECT TO authenticated USING (((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text, 'viewer'::text])) OR (EXISTS ( SELECT 1
   FROM (jobs j
     JOIN job_assignments a ON ((a.job_id = j.id)))
  WHERE ((j.organization_id = contacts.organization_id) AND (j.contact_id = contacts.id) AND (a.user_id = ( SELECT auth.uid() AS uid)))))));

CREATE POLICY contacts_update ON public.contacts AS permissive FOR UPDATE TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text]))) WITH CHECK ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])));

CREATE POLICY content_items_delete ON public.content_items AS permissive FOR DELETE TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text])));

CREATE POLICY content_items_insert ON public.content_items AS permissive FOR INSERT TO authenticated WITH CHECK ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])));

CREATE POLICY content_items_select ON public.content_items AS permissive FOR SELECT TO authenticated USING ((private.org_role(organization_id) IS NOT NULL));

CREATE POLICY content_items_update ON public.content_items AS permissive FOR UPDATE TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text]))) WITH CHECK ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])));

CREATE POLICY conversations_delete ON public.conversations AS permissive FOR DELETE TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text])));

CREATE POLICY conversations_insert ON public.conversations AS permissive FOR INSERT TO authenticated WITH CHECK ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])));

CREATE POLICY conversations_select ON public.conversations AS permissive FOR SELECT TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text, 'viewer'::text])));

CREATE POLICY conversations_update ON public.conversations AS permissive FOR UPDATE TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text]))) WITH CHECK ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])));

CREATE POLICY financial_entries_delete ON public.financial_entries AS permissive FOR DELETE TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text])));

CREATE POLICY financial_entries_insert ON public.financial_entries AS permissive FOR INSERT TO authenticated WITH CHECK ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])));

CREATE POLICY financial_entries_select ON public.financial_entries AS permissive FOR SELECT TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])));

CREATE POLICY financial_entries_update ON public.financial_entries AS permissive FOR UPDATE TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text]))) WITH CHECK ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])));

CREATE POLICY jobs_delete ON public.jobs AS permissive FOR DELETE TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text])));

CREATE POLICY jobs_insert ON public.jobs AS permissive FOR INSERT TO authenticated WITH CHECK ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])));

CREATE POLICY jobs_select ON public.jobs AS permissive FOR SELECT TO authenticated USING (((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text, 'viewer'::text])) OR private.is_assigned_job(organization_id, id)));

CREATE POLICY jobs_update ON public.jobs AS permissive FOR UPDATE TO authenticated USING (((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])) OR private.is_assigned_job(organization_id, id))) WITH CHECK (((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])) OR private.is_assigned_job(organization_id, id)));

CREATE POLICY leads_delete ON public.leads AS permissive FOR DELETE TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text])));

CREATE POLICY leads_insert ON public.leads AS permissive FOR INSERT TO authenticated WITH CHECK ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])));

CREATE POLICY leads_select ON public.leads AS permissive FOR SELECT TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text, 'viewer'::text])));

CREATE POLICY leads_update ON public.leads AS permissive FOR UPDATE TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text]))) WITH CHECK ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])));

CREATE POLICY media_assets_delete ON public.media_assets AS permissive FOR DELETE TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text])));

CREATE POLICY media_assets_insert ON public.media_assets AS permissive FOR INSERT TO authenticated WITH CHECK ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])));

CREATE POLICY media_assets_select ON public.media_assets AS permissive FOR SELECT TO authenticated USING ((private.org_role(organization_id) IS NOT NULL));

CREATE POLICY media_assets_update ON public.media_assets AS permissive FOR UPDATE TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text]))) WITH CHECK ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])));

CREATE POLICY memberships_delete ON public.memberships AS permissive FOR DELETE TO authenticated USING (((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text])) AND (role <> 'owner'::text)));

CREATE POLICY memberships_insert ON public.memberships AS permissive FOR INSERT TO authenticated WITH CHECK (((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text])) AND (role = ANY (ARRAY['admin'::text, 'manager'::text, 'worker'::text, 'viewer'::text]))));

CREATE POLICY memberships_select ON public.memberships AS permissive FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR (private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text]))));

CREATE POLICY memberships_update ON public.memberships AS permissive FOR UPDATE TO authenticated USING (((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text])) AND (role <> 'owner'::text))) WITH CHECK (((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text])) AND (role = ANY (ARRAY['admin'::text, 'manager'::text, 'worker'::text, 'viewer'::text]))));

CREATE POLICY merch_creative_manager_delete ON public.merch_creative_proposals AS permissive FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.organization_id = merch_creative_proposals.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text]))))));

CREATE POLICY merch_creative_manager_insert ON public.merch_creative_proposals AS permissive FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.organization_id = merch_creative_proposals.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text]))))));

CREATE POLICY merch_creative_manager_update ON public.merch_creative_proposals AS permissive FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.organization_id = merch_creative_proposals.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.organization_id = merch_creative_proposals.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text]))))));

CREATE POLICY merch_creative_member_select ON public.merch_creative_proposals AS permissive FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.organization_id = merch_creative_proposals.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY merch_order_items_member_delete ON public.merch_order_items AS permissive FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.organization_id = merch_order_items.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text]))))));

CREATE POLICY merch_order_items_member_insert ON public.merch_order_items AS permissive FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.organization_id = merch_order_items.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text]))))));

CREATE POLICY merch_order_items_member_select ON public.merch_order_items AS permissive FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.organization_id = merch_order_items.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY merch_order_items_member_update ON public.merch_order_items AS permissive FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.organization_id = merch_order_items.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.organization_id = merch_order_items.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text]))))));

CREATE POLICY merch_orders_member_delete ON public.merch_orders AS permissive FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.organization_id = merch_orders.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text]))))));

CREATE POLICY merch_orders_member_insert ON public.merch_orders AS permissive FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.organization_id = merch_orders.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text]))))));

CREATE POLICY merch_orders_member_select ON public.merch_orders AS permissive FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.organization_id = merch_orders.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY merch_orders_member_update ON public.merch_orders AS permissive FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.organization_id = merch_orders.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.organization_id = merch_orders.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text]))))));

CREATE POLICY merch_outreach_manager_delete ON public.merch_outreach_drafts AS permissive FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.organization_id = merch_outreach_drafts.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text]))))));

CREATE POLICY merch_outreach_manager_insert ON public.merch_outreach_drafts AS permissive FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.organization_id = merch_outreach_drafts.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text]))))));

CREATE POLICY merch_outreach_manager_update ON public.merch_outreach_drafts AS permissive FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.organization_id = merch_outreach_drafts.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.organization_id = merch_outreach_drafts.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text]))))));

CREATE POLICY merch_outreach_member_select ON public.merch_outreach_drafts AS permissive FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.organization_id = merch_outreach_drafts.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY merch_products_member_delete ON public.merch_products AS permissive FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.organization_id = merch_products.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text]))))));

CREATE POLICY merch_products_member_insert ON public.merch_products AS permissive FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.organization_id = merch_products.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text]))))));

CREATE POLICY merch_products_member_select ON public.merch_products AS permissive FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.organization_id = merch_products.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY merch_products_member_update ON public.merch_products AS permissive FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.organization_id = merch_products.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.organization_id = merch_products.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text]))))));

CREATE POLICY merch_prospects_manager_delete ON public.merch_prospects AS permissive FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.organization_id = merch_prospects.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text]))))));

CREATE POLICY merch_prospects_manager_insert ON public.merch_prospects AS permissive FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.organization_id = merch_prospects.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text]))))));

CREATE POLICY merch_prospects_manager_update ON public.merch_prospects AS permissive FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.organization_id = merch_prospects.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.organization_id = merch_prospects.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid)) AND (m.role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text]))))));

CREATE POLICY merch_prospects_member_select ON public.merch_prospects AS permissive FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.organization_id = merch_prospects.organization_id) AND (m.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY messages_insert ON public.messages AS permissive FOR INSERT TO authenticated WITH CHECK ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])));

CREATE POLICY messages_select ON public.messages AS permissive FOR SELECT TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text, 'viewer'::text])));

CREATE POLICY messages_update ON public.messages AS permissive FOR UPDATE TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text]))) WITH CHECK ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])));

CREATE POLICY missed_calls_select ON public.missed_calls AS permissive FOR SELECT TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text, 'viewer'::text])));

CREATE POLICY opportunities_delete ON public.opportunities AS permissive FOR DELETE TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text])));

CREATE POLICY opportunities_insert ON public.opportunities AS permissive FOR INSERT TO authenticated WITH CHECK ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])));

CREATE POLICY opportunities_select ON public.opportunities AS permissive FOR SELECT TO authenticated USING ((private.org_role(organization_id) IS NOT NULL));

CREATE POLICY opportunities_update ON public.opportunities AS permissive FOR UPDATE TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text]))) WITH CHECK ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])));

CREATE POLICY organizations_select ON public.organizations AS permissive FOR SELECT TO authenticated USING (private.is_org_member(id));

CREATE POLICY organizations_update_owner_admin ON public.organizations AS permissive FOR UPDATE TO authenticated USING ((private.org_role(id) = ANY (ARRAY['owner'::text, 'admin'::text]))) WITH CHECK ((private.org_role(id) = ANY (ARRAY['owner'::text, 'admin'::text])));

CREATE POLICY photos_delete ON public.job_photos AS permissive FOR DELETE TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])));

CREATE POLICY photos_insert ON public.job_photos AS permissive FOR INSERT TO authenticated WITH CHECK (((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])) OR private.is_assigned_job(organization_id, job_id)));

CREATE POLICY photos_select ON public.job_photos AS permissive FOR SELECT TO authenticated USING (((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text, 'viewer'::text])) OR private.is_assigned_job(organization_id, job_id)));

CREATE POLICY photos_update ON public.job_photos AS permissive FOR UPDATE TO authenticated USING (((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])) OR private.is_assigned_job(organization_id, job_id))) WITH CHECK (((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])) OR private.is_assigned_job(organization_id, job_id)));

CREATE POLICY quote_items_delete ON public.quote_items AS permissive FOR DELETE TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text])));

CREATE POLICY quote_items_insert ON public.quote_items AS permissive FOR INSERT TO authenticated WITH CHECK ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])));

CREATE POLICY quote_items_select ON public.quote_items AS permissive FOR SELECT TO authenticated USING ((private.org_role(organization_id) IS NOT NULL));

CREATE POLICY quote_items_update ON public.quote_items AS permissive FOR UPDATE TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text]))) WITH CHECK ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])));

CREATE POLICY quotes_delete ON public.quotes AS permissive FOR DELETE TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text])));

CREATE POLICY quotes_insert ON public.quotes AS permissive FOR INSERT TO authenticated WITH CHECK ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])));

CREATE POLICY quotes_select ON public.quotes AS permissive FOR SELECT TO authenticated USING ((private.org_role(organization_id) IS NOT NULL));

CREATE POLICY quotes_update ON public.quotes AS permissive FOR UPDATE TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text]))) WITH CHECK ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])));

CREATE POLICY service_catalog_delete ON public.service_catalog AS permissive FOR DELETE TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text])));

CREATE POLICY service_catalog_insert ON public.service_catalog AS permissive FOR INSERT TO authenticated WITH CHECK ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])));

CREATE POLICY service_catalog_select ON public.service_catalog AS permissive FOR SELECT TO authenticated USING (private.is_org_member(organization_id));

CREATE POLICY service_catalog_update ON public.service_catalog AS permissive FOR UPDATE TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text]))) WITH CHECK ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])));

CREATE POLICY signatures_delete ON public.job_signatures AS permissive FOR DELETE TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])));

CREATE POLICY signatures_insert ON public.job_signatures AS permissive FOR INSERT TO authenticated WITH CHECK (((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])) OR private.is_assigned_job(organization_id, job_id)));

CREATE POLICY signatures_select ON public.job_signatures AS permissive FOR SELECT TO authenticated USING (((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text, 'viewer'::text])) OR private.is_assigned_job(organization_id, job_id)));

CREATE POLICY signatures_update ON public.job_signatures AS permissive FOR UPDATE TO authenticated USING (((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])) OR private.is_assigned_job(organization_id, job_id))) WITH CHECK (((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])) OR private.is_assigned_job(organization_id, job_id)));

CREATE POLICY tasks_delete ON public.tasks AS permissive FOR DELETE TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text])));

CREATE POLICY tasks_insert ON public.tasks AS permissive FOR INSERT TO authenticated WITH CHECK ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])));

CREATE POLICY tasks_select ON public.tasks AS permissive FOR SELECT TO authenticated USING ((private.org_role(organization_id) IS NOT NULL));

CREATE POLICY tasks_update ON public.tasks AS permissive FOR UPDATE TO authenticated USING (((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])) OR (assigned_to = ( SELECT auth.uid() AS uid)))) WITH CHECK (((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text])) OR (assigned_to = ( SELECT auth.uid() AS uid))));

CREATE POLICY team_invites_delete ON public.team_invites AS permissive FOR DELETE TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text])));

CREATE POLICY team_invites_select ON public.team_invites AS permissive FOR SELECT TO authenticated USING ((private.org_role(organization_id) = ANY (ARRAY['owner'::text, 'admin'::text])));

CREATE POLICY time_entries_select ON public.time_entries AS permissive FOR SELECT TO authenticated USING (private.can_access_job(organization_id, job_id));

REVOKE ALL ON SCHEMA public, private FROM PUBLIC, anon, authenticated, service_role;

GRANT CREATE, USAGE ON SCHEMA private TO postgres;

GRANT CREATE, USAGE ON SCHEMA public TO pg_database_owner;

GRANT USAGE ON SCHEMA private TO authenticated;

GRANT USAGE ON SCHEMA public TO anon;

GRANT USAGE ON SCHEMA public TO authenticated;

GRANT USAGE ON SCHEMA public TO postgres;

GRANT USAGE ON SCHEMA public TO service_role;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;

GRANT MAINTAIN ON TABLE public.ai_agent_events TO authenticated;
GRANT MAINTAIN ON TABLE public.ai_agent_events TO service_role;
GRANT MAINTAIN ON TABLE public.ai_agents TO authenticated;
GRANT MAINTAIN ON TABLE public.ai_agents TO service_role;
GRANT MAINTAIN ON TABLE public.ai_approvals TO authenticated;
GRANT MAINTAIN ON TABLE public.ai_approvals TO service_role;
GRANT MAINTAIN ON TABLE public.ai_runs TO authenticated;
GRANT MAINTAIN ON TABLE public.ai_runs TO service_role;
GRANT MAINTAIN ON TABLE public.app_snapshots TO authenticated;
GRANT MAINTAIN ON TABLE public.app_snapshots TO service_role;
GRANT MAINTAIN ON TABLE public.audit_log TO authenticated;
GRANT MAINTAIN ON TABLE public.audit_log TO service_role;
GRANT MAINTAIN ON TABLE public.automation_runs TO authenticated;
GRANT MAINTAIN ON TABLE public.automation_runs TO service_role;
GRANT MAINTAIN ON TABLE public.automations TO authenticated;
GRANT MAINTAIN ON TABLE public.automations TO service_role;
GRANT MAINTAIN ON TABLE public.bco_integrations TO authenticated;
GRANT MAINTAIN ON TABLE public.bco_integrations TO service_role;
GRANT MAINTAIN ON TABLE public.bco_websites TO authenticated;
GRANT MAINTAIN ON TABLE public.bco_websites TO service_role;
GRANT MAINTAIN ON TABLE public.booking_throttle TO service_role;
GRANT MAINTAIN ON TABLE public.contacts TO authenticated;
GRANT MAINTAIN ON TABLE public.contacts TO service_role;
GRANT MAINTAIN ON TABLE public.content_items TO authenticated;
GRANT MAINTAIN ON TABLE public.content_items TO service_role;
GRANT MAINTAIN ON TABLE public.conversations TO authenticated;
GRANT MAINTAIN ON TABLE public.conversations TO service_role;
GRANT MAINTAIN ON TABLE public.financial_entries TO authenticated;
GRANT MAINTAIN ON TABLE public.financial_entries TO service_role;
GRANT MAINTAIN ON TABLE public.integration_webhook_tokens TO service_role;
GRANT MAINTAIN ON TABLE public.job_assignments TO authenticated;
GRANT MAINTAIN ON TABLE public.job_assignments TO service_role;
GRANT MAINTAIN ON TABLE public.job_checklist_items TO authenticated;
GRANT MAINTAIN ON TABLE public.job_checklist_items TO service_role;
GRANT MAINTAIN ON TABLE public.job_photos TO authenticated;
GRANT MAINTAIN ON TABLE public.job_photos TO service_role;
GRANT MAINTAIN ON TABLE public.job_signatures TO authenticated;
GRANT MAINTAIN ON TABLE public.job_signatures TO service_role;
GRANT MAINTAIN ON TABLE public.jobs TO authenticated;
GRANT MAINTAIN ON TABLE public.jobs TO service_role;
GRANT MAINTAIN ON TABLE public.leads TO authenticated;
GRANT MAINTAIN ON TABLE public.leads TO service_role;
GRANT MAINTAIN ON TABLE public.media_assets TO authenticated;
GRANT MAINTAIN ON TABLE public.media_assets TO service_role;
GRANT MAINTAIN ON TABLE public.memberships TO authenticated;
GRANT MAINTAIN ON TABLE public.memberships TO service_role;
GRANT MAINTAIN ON TABLE public.merch_creative_proposals TO authenticated;
GRANT MAINTAIN ON TABLE public.merch_creative_proposals TO service_role;
GRANT MAINTAIN ON TABLE public.merch_order_items TO authenticated;
GRANT MAINTAIN ON TABLE public.merch_order_items TO service_role;
GRANT MAINTAIN ON TABLE public.merch_orders TO authenticated;
GRANT MAINTAIN ON TABLE public.merch_orders TO service_role;
GRANT MAINTAIN ON TABLE public.merch_outreach_drafts TO authenticated;
GRANT MAINTAIN ON TABLE public.merch_outreach_drafts TO service_role;
GRANT MAINTAIN ON TABLE public.merch_products TO authenticated;
GRANT MAINTAIN ON TABLE public.merch_products TO service_role;
GRANT MAINTAIN ON TABLE public.merch_prospects TO authenticated;
GRANT MAINTAIN ON TABLE public.merch_prospects TO service_role;
GRANT MAINTAIN ON TABLE public.messages TO authenticated;
GRANT MAINTAIN ON TABLE public.messages TO service_role;
GRANT MAINTAIN ON TABLE public.missed_calls TO authenticated;
GRANT MAINTAIN ON TABLE public.missed_calls TO service_role;
GRANT MAINTAIN ON TABLE public.opportunities TO authenticated;
GRANT MAINTAIN ON TABLE public.opportunities TO service_role;
GRANT MAINTAIN ON TABLE public.organizations TO authenticated;
GRANT MAINTAIN ON TABLE public.organizations TO service_role;
GRANT MAINTAIN ON TABLE public.quote_items TO authenticated;
GRANT MAINTAIN ON TABLE public.quote_items TO service_role;
GRANT MAINTAIN ON TABLE public.quotes TO authenticated;
GRANT MAINTAIN ON TABLE public.quotes TO service_role;
GRANT MAINTAIN ON TABLE public.service_bookings TO authenticated;
GRANT MAINTAIN ON TABLE public.service_bookings TO service_role;
GRANT MAINTAIN ON TABLE public.service_catalog TO authenticated;
GRANT MAINTAIN ON TABLE public.service_catalog TO service_role;
GRANT MAINTAIN ON TABLE public.tasks TO authenticated;
GRANT MAINTAIN ON TABLE public.tasks TO service_role;
GRANT MAINTAIN ON TABLE public.team_invites TO authenticated;
GRANT MAINTAIN ON TABLE public.team_invites TO service_role;
GRANT MAINTAIN ON TABLE public.time_entries TO authenticated;
GRANT MAINTAIN ON TABLE public.time_entries TO service_role;
GRANT MAINTAIN ON TABLE public.webhook_events TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_agent_events TO postgres;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_agent_events TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_agents TO postgres;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_agents TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_approvals TO postgres;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_approvals TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_runs TO postgres;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.ai_runs TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.app_snapshots TO postgres;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.app_snapshots TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.audit_log TO postgres;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.audit_log TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.automation_runs TO postgres;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.automation_runs TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.automations TO postgres;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.automations TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.bco_integrations TO postgres;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.bco_integrations TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.bco_websites TO postgres;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.bco_websites TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.booking_throttle TO postgres;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.booking_throttle TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.contacts TO postgres;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.contacts TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.content_items TO postgres;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.content_items TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.conversations TO postgres;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.conversations TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.financial_entries TO postgres;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.financial_entries TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.integration_webhook_tokens TO postgres;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.integration_webhook_tokens TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.job_assignments TO postgres;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.job_assignments TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.job_checklist_items TO postgres;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.job_checklist_items TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.job_photos TO postgres;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.job_photos TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.job_signatures TO postgres;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.job_signatures TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.jobs TO postgres;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.jobs TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.lead_followup_queue TO postgres;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.lead_followup_queue TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.leads TO postgres;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.leads TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.media_assets TO postgres;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.media_assets TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.memberships TO postgres;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.memberships TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.merch_creative_proposals TO postgres;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.merch_creative_proposals TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.merch_order_items TO postgres;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.merch_order_items TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.merch_orders TO postgres;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.merch_orders TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.merch_outreach_drafts TO postgres;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.merch_outreach_drafts TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.merch_products TO postgres;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.merch_products TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.merch_prospects TO postgres;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.merch_prospects TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.messages TO postgres;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.messages TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.missed_calls TO postgres;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.missed_calls TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.opportunities TO postgres;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.opportunities TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.organizations TO postgres;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.organizations TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.quote_items TO postgres;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.quote_items TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.quotes TO postgres;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.quotes TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.service_bookings TO postgres;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.service_bookings TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.service_catalog TO postgres;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.service_catalog TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.tasks TO postgres;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.tasks TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.team_invites TO postgres;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.team_invites TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.time_entries TO postgres;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.time_entries TO service_role;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.webhook_events TO postgres;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.webhook_events TO service_role;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.ai_agent_events TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.ai_agents TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.ai_approvals TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.ai_runs TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.app_snapshots TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.audit_log TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.automation_runs TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.automations TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.bco_integrations TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.bco_websites TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.contacts TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.content_items TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.conversations TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.financial_entries TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.job_assignments TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.job_checklist_items TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.job_photos TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.job_signatures TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.jobs TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.leads TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.media_assets TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.merch_creative_proposals TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.merch_order_items TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.merch_orders TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.merch_outreach_drafts TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.merch_products TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.merch_prospects TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.messages TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.missed_calls TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.opportunities TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.organizations TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.quote_items TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.quotes TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.service_bookings TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.service_catalog TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.tasks TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.team_invites TO authenticated;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE public.time_entries TO authenticated;

GRANT SELECT ON TABLE public.lead_followup_queue TO authenticated;

GRANT SELECT ON TABLE public.memberships TO authenticated;

REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.audit_log_id_seq TO anon;

GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.audit_log_id_seq TO authenticated;

GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.audit_log_id_seq TO postgres;

GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.audit_log_id_seq TO service_role;

GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.booking_throttle_id_seq TO anon;

GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.booking_throttle_id_seq TO authenticated;

GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.booking_throttle_id_seq TO postgres;

GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.booking_throttle_id_seq TO service_role;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public, private FROM PUBLIC, anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION private.can_access_job(org uuid, job uuid) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION private.is_assigned_job(org uuid, jid uuid) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION private.is_org_member(org uuid) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION private.normalize_phone(input text) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION private.org_role(org uuid) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.audit_business_change() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.claim_team_invite(invite_token text) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.create_my_organization(org_name text, org_slug text) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.create_team_invite(org_id uuid, invite_email text, invite_role text) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.disable_integration_webhook(org_id uuid, webhook_kind text) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.list_org_members(org_id uuid) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.maintenance_cleanup() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.quote_items_recalculate_totals() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.remove_org_member(org_id uuid, member_user_id uuid) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.rotate_integration_webhook(org_id uuid, webhook_kind text) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.set_my_organization_slug(new_slug text) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.start_job_timer(target_job_id uuid) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.stop_job_timer(entry_id uuid) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.touch_ai_agents_updated_at() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.update_my_organization_profile(org_id uuid, new_name text, new_slug text, new_phone text, new_email text, new_address text, new_ico text) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.update_org_integration_settings(org_id uuid, new_booking_enabled boolean, new_booking_intro text, new_sms_enabled boolean, new_sms_provider text, new_sms_sender text, new_missed_call_template text) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.update_org_member_role(org_id uuid, member_user_id uuid, new_role text) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.update_org_sms_limits(org_id uuid, new_daily_limit integer, new_monthly_limit integer) FROM PUBLIC;

GRANT MAINTAIN ON TABLE public.lead_followup_queue TO service_role;

GRANT EXECUTE ON FUNCTION private.can_access_job(org uuid, job uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION private.can_access_job(org uuid, job uuid) TO postgres;

GRANT EXECUTE ON FUNCTION private.is_assigned_job(org uuid, jid uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION private.is_assigned_job(org uuid, jid uuid) TO postgres;

GRANT EXECUTE ON FUNCTION private.is_org_member(org uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION private.is_org_member(org uuid) TO postgres;

GRANT EXECUTE ON FUNCTION private.normalize_phone(input text) TO postgres;

GRANT EXECUTE ON FUNCTION private.normalize_phone(input text) TO service_role;

GRANT EXECUTE ON FUNCTION private.org_role(org uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION private.org_role(org uuid) TO postgres;

GRANT EXECUTE ON FUNCTION public.audit_business_change() TO postgres;

GRANT EXECUTE ON FUNCTION public.audit_business_change() TO service_role;

GRANT EXECUTE ON FUNCTION public.bco_dashboard_metrics(target_org_id uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.bco_dashboard_metrics(target_org_id uuid) TO postgres;

GRANT EXECUTE ON FUNCTION public.bco_dashboard_metrics(target_org_id uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.bco_finance_metrics(target_org_id uuid, from_date date, to_date date) TO authenticated;

GRANT EXECUTE ON FUNCTION public.bco_finance_metrics(target_org_id uuid, from_date date, to_date date) TO postgres;

GRANT EXECUTE ON FUNCTION public.bco_finance_metrics(target_org_id uuid, from_date date, to_date date) TO service_role;

GRANT EXECUTE ON FUNCTION public.bco_jobs_metrics(target_org_id uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.bco_jobs_metrics(target_org_id uuid) TO postgres;

GRANT EXECUTE ON FUNCTION public.bco_jobs_metrics(target_org_id uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.bco_sales_metrics(target_org_id uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.bco_sales_metrics(target_org_id uuid) TO postgres;

GRANT EXECUTE ON FUNCTION public.bco_sales_metrics(target_org_id uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.claim_team_invite(invite_token text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.claim_team_invite(invite_token text) TO postgres;

GRANT EXECUTE ON FUNCTION public.claim_team_invite(invite_token text) TO service_role;

GRANT EXECUTE ON FUNCTION public.create_my_organization(org_name text, org_slug text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_my_organization(org_name text, org_slug text) TO postgres;

GRANT EXECUTE ON FUNCTION public.create_my_organization(org_name text, org_slug text) TO service_role;

GRANT EXECUTE ON FUNCTION public.create_team_invite(org_id uuid, invite_email text, invite_role text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_team_invite(org_id uuid, invite_email text, invite_role text) TO postgres;

GRANT EXECUTE ON FUNCTION public.create_team_invite(org_id uuid, invite_email text, invite_role text) TO service_role;

GRANT EXECUTE ON FUNCTION public.disable_integration_webhook(org_id uuid, webhook_kind text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.disable_integration_webhook(org_id uuid, webhook_kind text) TO postgres;

GRANT EXECUTE ON FUNCTION public.disable_integration_webhook(org_id uuid, webhook_kind text) TO service_role;

GRANT EXECUTE ON FUNCTION public.list_org_members(org_id uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.list_org_members(org_id uuid) TO postgres;

GRANT EXECUTE ON FUNCTION public.list_org_members(org_id uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.maintenance_cleanup() TO postgres;

GRANT EXECUTE ON FUNCTION public.maintenance_cleanup() TO service_role;

GRANT EXECUTE ON FUNCTION public.quote_items_recalculate_totals() TO postgres;

GRANT EXECUTE ON FUNCTION public.quote_items_recalculate_totals() TO service_role;

GRANT EXECUTE ON FUNCTION public.recalculate_quote_totals(target_quote_id uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.recalculate_quote_totals(target_quote_id uuid) TO postgres;

GRANT EXECUTE ON FUNCTION public.recalculate_quote_totals(target_quote_id uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.remove_org_member(org_id uuid, member_user_id uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.remove_org_member(org_id uuid, member_user_id uuid) TO postgres;

GRANT EXECUTE ON FUNCTION public.remove_org_member(org_id uuid, member_user_id uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.rotate_integration_webhook(org_id uuid, webhook_kind text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.rotate_integration_webhook(org_id uuid, webhook_kind text) TO postgres;

GRANT EXECUTE ON FUNCTION public.rotate_integration_webhook(org_id uuid, webhook_kind text) TO service_role;

GRANT EXECUTE ON FUNCTION public.set_merch_updated_at() TO postgres;

GRANT EXECUTE ON FUNCTION public.set_merch_updated_at() TO service_role;

GRANT EXECUTE ON FUNCTION public.set_my_organization_slug(new_slug text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.set_my_organization_slug(new_slug text) TO postgres;

GRANT EXECUTE ON FUNCTION public.set_my_organization_slug(new_slug text) TO service_role;

GRANT EXECUTE ON FUNCTION public.start_job_timer(target_job_id uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.start_job_timer(target_job_id uuid) TO postgres;

GRANT EXECUTE ON FUNCTION public.start_job_timer(target_job_id uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.stop_job_timer(entry_id uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.stop_job_timer(entry_id uuid) TO postgres;

GRANT EXECUTE ON FUNCTION public.stop_job_timer(entry_id uuid) TO service_role;

GRANT EXECUTE ON FUNCTION public.touch_ai_agents_updated_at() TO postgres;

GRANT EXECUTE ON FUNCTION public.touch_ai_agents_updated_at() TO service_role;

GRANT EXECUTE ON FUNCTION public.touch_updated_at() TO postgres;

GRANT EXECUTE ON FUNCTION public.touch_updated_at() TO service_role;

GRANT EXECUTE ON FUNCTION public.update_my_organization_profile(org_id uuid, new_name text, new_slug text, new_phone text, new_email text, new_address text, new_ico text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.update_my_organization_profile(org_id uuid, new_name text, new_slug text, new_phone text, new_email text, new_address text, new_ico text) TO postgres;

GRANT EXECUTE ON FUNCTION public.update_my_organization_profile(org_id uuid, new_name text, new_slug text, new_phone text, new_email text, new_address text, new_ico text) TO service_role;

GRANT EXECUTE ON FUNCTION public.update_org_integration_settings(org_id uuid, new_booking_enabled boolean, new_booking_intro text, new_sms_enabled boolean, new_sms_provider text, new_sms_sender text, new_missed_call_template text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.update_org_integration_settings(org_id uuid, new_booking_enabled boolean, new_booking_intro text, new_sms_enabled boolean, new_sms_provider text, new_sms_sender text, new_missed_call_template text) TO postgres;

GRANT EXECUTE ON FUNCTION public.update_org_integration_settings(org_id uuid, new_booking_enabled boolean, new_booking_intro text, new_sms_enabled boolean, new_sms_provider text, new_sms_sender text, new_missed_call_template text) TO service_role;

GRANT EXECUTE ON FUNCTION public.update_org_member_role(org_id uuid, member_user_id uuid, new_role text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.update_org_member_role(org_id uuid, member_user_id uuid, new_role text) TO postgres;

GRANT EXECUTE ON FUNCTION public.update_org_member_role(org_id uuid, member_user_id uuid, new_role text) TO service_role;

GRANT EXECUTE ON FUNCTION public.update_org_sms_limits(org_id uuid, new_daily_limit integer, new_monthly_limit integer) TO authenticated;

GRANT EXECUTE ON FUNCTION public.update_org_sms_limits(org_id uuid, new_daily_limit integer, new_monthly_limit integer) TO postgres;

GRANT EXECUTE ON FUNCTION public.update_org_sms_limits(org_id uuid, new_daily_limit integer, new_monthly_limit integer) TO service_role;
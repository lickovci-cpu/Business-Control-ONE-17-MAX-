-- Rollback for 20261112120000_autonomous_outbound.sql.
-- Run only if the outbound feature is not in use. This drops only objects created by that migration.
drop trigger if exists trg_bco_validate_outbound_message_scope on public.outbound_messages;
drop function if exists public.bco_validate_outbound_message_scope();
drop table if exists public.outreach_audit_events;
drop table if exists public.outbound_messages;
drop table if exists public.outreach_suppressions;
drop table if exists public.outreach_campaign_policies;
drop table if exists public.outbound_provider_credentials;

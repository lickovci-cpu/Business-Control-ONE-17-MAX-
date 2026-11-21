-- Staging-only parity correction. No production target, no application rows.

DROP SEQUENCE public.audit_log_id_seq;

DROP SEQUENCE public.booking_throttle_id_seq;

ALTER SEQUENCE public.audit_log_id_seq1 RENAME TO audit_log_id_seq;

ALTER SEQUENCE public.booking_throttle_id_seq1 RENAME TO booking_throttle_id_seq;

REVOKE ALL ON SCHEMA public, private FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated, service_role;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public, private FROM PUBLIC, anon, authenticated, service_role;

GRANT CREATE, USAGE ON SCHEMA private TO postgres;

GRANT CREATE, USAGE ON SCHEMA public TO pg_database_owner;

GRANT USAGE ON SCHEMA private TO authenticated;

GRANT USAGE ON SCHEMA public TO anon;

GRANT USAGE ON SCHEMA public TO authenticated;

GRANT USAGE ON SCHEMA public TO postgres;

GRANT USAGE ON SCHEMA public TO service_role;

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

GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.audit_log_id_seq TO anon;

GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.audit_log_id_seq TO authenticated;

GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.audit_log_id_seq TO postgres;

GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.audit_log_id_seq TO service_role;

GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.booking_throttle_id_seq TO anon;

GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.booking_throttle_id_seq TO authenticated;

GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.booking_throttle_id_seq TO postgres;

GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.booking_throttle_id_seq TO service_role;

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
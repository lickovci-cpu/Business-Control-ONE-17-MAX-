create index if not exists ai_agent_events_agent_id_idx on public.ai_agent_events(agent_id);
create index if not exists ai_approvals_agent_id_idx on public.ai_approvals(agent_id);
create index if not exists app_snapshots_user_id_idx on public.app_snapshots(user_id);

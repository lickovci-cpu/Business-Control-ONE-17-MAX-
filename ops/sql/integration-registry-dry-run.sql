-- READ ONLY: BCO website/integration registry and content delivery readiness.
-- No INSERT/UPDATE/DELETE/DDL. Never expose credential values in this report.
select
  'website' as record_type,
  jsonb_build_object(
    'organization_id', organization_id,
    'name', name,
    'platform', platform,
    'status', status,
    'url', url,
    'repo_ref', repo_ref,
    'deploy_ref', deploy_ref,
    'last_audit_at', last_audit_at,
    'last_deploy_at', last_deploy_at
  ) as record
from public.bco_websites
union all
select
  'integration',
  jsonb_build_object(
    'organization_id', organization_id,
    'provider', provider,
    'name', name,
    'status', status,
    'credential_ref_configured', credential_ref is not null,
    'config_keys', coalesce(
      (select jsonb_agg(key order by key)
       from jsonb_object_keys(coalesce(config, '{}'::jsonb)) as keys(key)),
      '[]'::jsonb
    ),
    'last_checked_at', last_checked_at,
    'capabilities', capabilities
  )
from public.bco_integrations
union all
select
  'social_content',
  jsonb_build_object(
    'organization_id', organization_id,
    'content_status', status,
    'items', count(*),
    'items_without_assets', count(*) filter (
      where coalesce(array_length(asset_ids, 1), 0) = 0
    )
  )
from public.content_items
group by organization_id, status
union all
select
  'media_assets',
  jsonb_build_object('organization_id', organization_id, 'assets', count(*))
from public.media_assets
group by organization_id
order by record_type, record;

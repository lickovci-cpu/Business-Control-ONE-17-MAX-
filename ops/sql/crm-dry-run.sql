-- READ ONLY CRM integrity / migration dry-run. No schema changes or data writes.
select 'leads_without_contact' as check_name, count(*) as affected_rows
from public.leads where contact_id is null
union all
select 'opportunities_without_contact', count(*)
from public.opportunities where contact_id is null
union all
select 'leads_with_orphan_contact', count(*)
from public.leads l left join public.contacts c
  on c.id = l.contact_id and c.organization_id = l.organization_id
where l.contact_id is not null and c.id is null
union all
select 'opportunities_with_orphan_contact', count(*)
from public.opportunities o left join public.contacts c
  on c.id = o.contact_id and c.organization_id = o.organization_id
where o.contact_id is not null and c.id is null
union all
select 'contacts_duplicate_email_within_org', count(*)
from (
  select organization_id, lower(trim(email))
  from public.contacts
  where nullif(trim(email), '') is not null
  group by organization_id, lower(trim(email))
  having count(*) > 1
) d
union all
select 'leads_duplicate_contact_source_within_org', count(*)
from (
  select organization_id, contact_id, lower(coalesce(source, ''))
  from public.leads
  where contact_id is not null
  group by organization_id, contact_id, lower(coalesce(source, ''))
  having count(*) > 1
) d;

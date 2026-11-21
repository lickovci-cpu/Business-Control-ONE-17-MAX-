-- READ ONLY prechecks for tasks policy / organization slug patch.
select m.user_id, count(*) filter (where m.role in ('owner','admin')) as admin_org_count
from public.memberships m
group by m.user_id
having count(*) filter (where m.role in ('owner','admin')) > 1
order by admin_org_count desc;

select count(*) as tasks_with_assignee_not_member
from public.tasks t
where t.assigned_to is not null
  and not exists (
    select 1 from public.memberships m
    where m.organization_id=t.organization_id
      and m.user_id=t.assigned_to
  );

select count(*) as tasks_with_no_assignee
from public.tasks where assigned_to is null;

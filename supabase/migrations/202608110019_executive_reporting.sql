-- Cross-module reporting permissions for the owner and management command center.

insert into public.permissions(key, description, module) values
  ('reports.read', 'View cross-module workforce and business analytics', 'reports'),
  ('reports.export', 'Export cross-module workforce and business reports', 'reports')
on conflict (key) do nothing;

insert into public.role_permissions(role_id, permission_key)
select r.id, p.key
from public.roles r
cross join public.permissions p
where p.module = 'reports'
  and (
    r.name in ('owner', 'hr_admin', 'payroll_officer', 'accountant')
    or (r.name in ('branch_manager', 'team_manager') and p.key = 'reports.read')
  )
on conflict do nothing;

create or replace function public.grant_reporting_permissions_for_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.name in ('owner', 'hr_admin', 'payroll_officer', 'accountant') then
    insert into public.role_permissions(role_id, permission_key)
    select new.id, p.key from public.permissions p where p.module = 'reports'
    on conflict do nothing;
  elsif new.name in ('branch_manager', 'team_manager') then
    insert into public.role_permissions(role_id, permission_key)
    values (new.id, 'reports.read')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger grant_reporting_permissions_after_role
after insert on public.roles
for each row execute function public.grant_reporting_permissions_for_role();

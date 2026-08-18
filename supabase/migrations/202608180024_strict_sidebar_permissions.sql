-- Every sidebar destination is backed by an explicit capability. Payroll
-- remains available to employees for their own published payslips without
-- granting access to company-wide payroll records.

insert into public.permissions(key, description, module) values
  ('payslips.read_own', 'View personal published payslips', 'payroll')
on conflict (key) do update
set description = excluded.description,
    module = excluded.module;

insert into public.role_permissions(role_id, permission_key)
select r.id, 'payslips.read_own'
from public.roles r
where r.name in ('owner', 'branch_manager', 'team_manager', 'employee')
on conflict do nothing;

create or replace function public.grant_sidebar_permissions_for_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.name in ('owner', 'branch_manager', 'team_manager', 'employee') then
    insert into public.role_permissions(role_id, permission_key)
    values (new.id, 'payslips.read_own')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger grant_sidebar_permissions_after_role
after insert on public.roles
for each row execute function public.grant_sidebar_permissions_for_role();

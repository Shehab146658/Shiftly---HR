-- Give every employee a safe default role and preserve it for future records.

create or replace function public.assign_default_employee_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role_id uuid;
begin
  select r.id into v_role_id
  from public.roles r
  where r.tenant_id = new.tenant_id
    and r.name = 'employee';

  if v_role_id is not null then
    insert into public.employee_role_assignments(tenant_id, employee_id, role_id, assigned_by)
    values (new.tenant_id, new.id, v_role_id, auth.uid())
    on conflict (employee_id, role_id) do nothing;
  end if;

  return new;
end;
$$;

create trigger assign_default_employee_role
after insert on public.employees
for each row execute function public.assign_default_employee_role();

insert into public.employee_role_assignments(tenant_id, employee_id, role_id, assigned_by)
select e.tenant_id, e.id, r.id, null
from public.employees e
join public.roles r
  on r.tenant_id = e.tenant_id
 and r.name = 'employee'
on conflict (employee_id, role_id) do nothing;

revoke execute on function public.assign_default_employee_role() from public, anon, authenticated;

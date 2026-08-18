-- Role assignments follow the dedicated access-control capability.
-- By default only the owner role owns roles.manage; an owner may explicitly
-- delegate it through the role-permission editor.

create or replace function public.set_employee_roles(p_employee_id uuid, p_role_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_role_ids uuid[] := coalesce(p_role_ids, array[]::uuid[]);
begin
  select e.tenant_id into v_tenant_id
  from public.employees e
  where e.id = p_employee_id;

  if v_tenant_id is null then
    raise exception 'Employee not found';
  end if;

  if not public.has_permission(v_tenant_id, 'roles.manage')
     and not public.is_tenant_owner(v_tenant_id)
     and not public.is_platform_admin()
  then
    raise exception 'Not authorized to assign employee roles';
  end if;

  if exists (
    select 1
    from unnest(v_role_ids) requested(role_id)
    left join public.roles r on r.id = requested.role_id
    where r.id is null or r.tenant_id <> v_tenant_id or r.name = 'owner'
  ) then
    raise exception 'One or more roles are not eligible for this employee';
  end if;

  delete from public.employee_role_assignments era
  where era.employee_id = p_employee_id
    and not (era.role_id = any(v_role_ids));

  insert into public.employee_role_assignments(tenant_id, employee_id, role_id, assigned_by)
  select v_tenant_id, p_employee_id, requested.role_id, auth.uid()
  from (select distinct unnest(v_role_ids) as role_id) requested
  on conflict (employee_id, role_id) do update
    set assigned_by = excluded.assigned_by;
end;
$$;

revoke execute on function public.set_employee_roles(uuid, uuid[]) from public, anon;
grant execute on function public.set_employee_roles(uuid, uuid[]) to authenticated;

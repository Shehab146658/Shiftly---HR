-- Employee access-role assignments with pending-account support.

create table public.employee_role_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (employee_id, role_id)
);

create index employee_role_assignments_tenant_employee_idx
  on public.employee_role_assignments(tenant_id, employee_id);

create or replace function public.validate_employee_role_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role_name text;
begin
  select r.name into v_role_name
  from public.roles r
  join public.employees e on e.id = new.employee_id
  where r.id = new.role_id
    and r.tenant_id = new.tenant_id
    and e.tenant_id = new.tenant_id;

  if v_role_name is null then
    raise exception 'Employee and role must belong to the same tenant';
  end if;

  if v_role_name = 'owner' then
    raise exception 'Company ownership must be managed from owner membership settings';
  end if;

  return new;
end;
$$;

create trigger validate_employee_role_assignment
before insert or update on public.employee_role_assignments
for each row execute function public.validate_employee_role_assignment();

create or replace function public.sync_employee_role_to_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee_id uuid;
  v_tenant_id uuid;
  v_role_id uuid;
  v_user_id uuid;
  v_membership_id uuid;
begin
  if tg_op = 'DELETE' then
    v_employee_id := old.employee_id;
    v_tenant_id := old.tenant_id;
    v_role_id := old.role_id;
  else
    v_employee_id := new.employee_id;
    v_tenant_id := new.tenant_id;
    v_role_id := new.role_id;
  end if;

  select e.user_id into v_user_id
  from public.employees e
  where e.id = v_employee_id and e.tenant_id = v_tenant_id;

  if v_user_id is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  select m.id into v_membership_id
  from public.memberships m
  where m.tenant_id = v_tenant_id
    and m.user_id = v_user_id
    and m.status in ('invited', 'active');

  if v_membership_id is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  if tg_op = 'DELETE' then
    delete from public.membership_roles
    where membership_id = v_membership_id and role_id = v_role_id;
  else
    insert into public.membership_roles(membership_id, role_id, assigned_by)
    values (v_membership_id, v_role_id, new.assigned_by)
    on conflict (membership_id, role_id) do update
      set assigned_by = excluded.assigned_by;
  end if;

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

create trigger sync_employee_role_to_membership
after insert or delete on public.employee_role_assignments
for each row execute function public.sync_employee_role_to_membership();

create or replace function public.sync_employee_roles_after_account_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membership_id uuid;
begin
  if new.user_id is null or new.user_id is not distinct from old.user_id then
    return new;
  end if;

  select m.id into v_membership_id
  from public.memberships m
  where m.tenant_id = new.tenant_id
    and m.user_id = new.user_id
    and m.status in ('invited', 'active');

  if v_membership_id is not null then
    insert into public.membership_roles(membership_id, role_id, assigned_by)
    select v_membership_id, era.role_id, era.assigned_by
    from public.employee_role_assignments era
    where era.employee_id = new.id
    on conflict (membership_id, role_id) do update
      set assigned_by = excluded.assigned_by;
  end if;

  return new;
end;
$$;

create trigger sync_employee_roles_after_account_link
after update of user_id on public.employees
for each row execute function public.sync_employee_roles_after_account_link();

create or replace function public.sync_membership_employee_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status not in ('invited', 'active') then
    return new;
  end if;

  insert into public.membership_roles(membership_id, role_id, assigned_by)
  select new.id, era.role_id, era.assigned_by
  from public.employees e
  join public.employee_role_assignments era on era.employee_id = e.id
  where e.tenant_id = new.tenant_id and e.user_id = new.user_id
  on conflict (membership_id, role_id) do update
    set assigned_by = excluded.assigned_by;

  return new;
end;
$$;

create trigger sync_membership_employee_roles
after insert or update of user_id, status on public.memberships
for each row execute function public.sync_membership_employee_roles();

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

  if not public.has_permission(v_tenant_id, 'memberships.manage')
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
    raise exception 'One or more roles are invalid for this employee';
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

create trigger audit_employee_role_assignments
after insert or update or delete on public.employee_role_assignments
for each row execute function public.capture_audit_log();

alter table public.employee_role_assignments enable row level security;

create policy employee_role_assignments_read on public.employee_role_assignments
for select to authenticated using (
  public.has_permission(tenant_id, 'roles.read')
  or public.has_permission(tenant_id, 'employees.read')
  or exists (
    select 1 from public.employees e
    where e.id = employee_id and e.user_id = auth.uid()
  )
);

create policy employee_role_assignments_manage on public.employee_role_assignments
for all to authenticated using (
  public.has_permission(tenant_id, 'memberships.manage')
) with check (
  public.has_permission(tenant_id, 'memberships.manage')
);

revoke execute on function public.validate_employee_role_assignment() from public, anon, authenticated;
revoke execute on function public.sync_employee_role_to_membership() from public, anon, authenticated;
revoke execute on function public.sync_employee_roles_after_account_link() from public, anon, authenticated;
revoke execute on function public.sync_membership_employee_roles() from public, anon, authenticated;
revoke execute on function public.set_employee_roles(uuid, uuid[]) from public, anon;
grant execute on function public.set_employee_roles(uuid, uuid[]) to authenticated;

grant select, insert, update, delete on public.employee_role_assignments to authenticated;
grant all on public.employee_role_assignments to service_role;

-- Client-feedback release: automatic business codes, multiple employee managers,
-- selective team membership, and clearer company permission language.

create or replace function public.next_tenant_entity_code(p_tenant_id uuid, p_entity text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next bigint;
  v_prefix text;
  v_width integer;
begin
  if p_tenant_id is null then raise exception 'Tenant is required to generate a code'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':' || p_entity, 0));

  case p_entity
    when 'branch' then
      v_prefix := 'BR'; v_width := 3;
      select coalesce(max((regexp_match(code, '^BR-([0-9]+)$'))[1]::bigint), 0) + 1 into v_next
      from public.branches where tenant_id = p_tenant_id and code ~ '^BR-[0-9]+$';
    when 'team' then
      v_prefix := 'TM'; v_width := 3;
      select coalesce(max((regexp_match(code, '^TM-([0-9]+)$'))[1]::bigint), 0) + 1 into v_next
      from public.teams where tenant_id = p_tenant_id and code ~ '^TM-[0-9]+$';
    when 'employee' then
      v_prefix := 'EMP'; v_width := 4;
      select coalesce(max((regexp_match(employee_code, '^EMP-([0-9]+)$'))[1]::bigint), 0) + 1 into v_next
      from public.employees where tenant_id = p_tenant_id and employee_code ~ '^EMP-[0-9]+$';
    when 'shift' then
      v_prefix := 'SH'; v_width := 3;
      select coalesce(max((regexp_match(code, '^SH-([0-9]+)$'))[1]::bigint), 0) + 1 into v_next
      from public.shift_templates where tenant_id = p_tenant_id and code ~ '^SH-[0-9]+$';
    when 'payroll' then
      v_prefix := 'PAY'; v_width := 4;
      select coalesce(max((regexp_match(upper(code), '^PAY-([0-9]+)$'))[1]::bigint), 0) + 1 into v_next
      from public.payroll_periods where tenant_id = p_tenant_id and upper(code) ~ '^PAY-[0-9]+$';
    when 'bonus_policy' then
      v_prefix := 'BON'; v_width := 3;
      select coalesce(max((regexp_match(code, '^BON-([0-9]+)$'))[1]::bigint), 0) + 1 into v_next
      from public.bonus_policies where tenant_id = p_tenant_id and code ~ '^BON-[0-9]+$';
    when 'sales_target' then
      v_prefix := 'TGT'; v_width := 4;
      select coalesce(max((regexp_match(code, '^TGT-([0-9]+)$'))[1]::bigint), 0) + 1 into v_next
      from public.sales_targets where tenant_id = p_tenant_id and code ~ '^TGT-[0-9]+$';
    when 'attendance_device' then
      v_prefix := 'DEV'; v_width := 3;
      select coalesce(max((regexp_match(code, '^DEV-([0-9]+)$'))[1]::bigint), 0) + 1 into v_next
      from public.attendance_devices where tenant_id = p_tenant_id and code ~ '^DEV-[0-9]+$';
    else
      raise exception 'Unsupported automatic code entity: %', p_entity;
  end case;

  return v_prefix || '-' || lpad(v_next::text, v_width, '0');
end;
$$;

create or replace function public.assign_automatic_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_entity text;
begin
  if nullif(trim(new.code), '') is not null then
    new.code := upper(trim(new.code));
    return new;
  end if;
  v_entity := case tg_table_name
    when 'branches' then 'branch'
    when 'teams' then 'team'
    when 'shift_templates' then 'shift'
    when 'payroll_periods' then 'payroll'
    when 'bonus_policies' then 'bonus_policy'
    when 'sales_targets' then 'sales_target'
    when 'attendance_devices' then 'attendance_device'
  end;
  if v_entity is null then raise exception 'Automatic code trigger is not configured for %', tg_table_name; end if;
  new.code := public.next_tenant_entity_code(new.tenant_id, v_entity);
  return new;
end;
$$;

create or replace function public.assign_automatic_employee_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.employee_code := coalesce(
    nullif(upper(trim(new.employee_code)), ''),
    public.next_tenant_entity_code(new.tenant_id, 'employee')
  );
  return new;
end;
$$;

create trigger branches_automatic_code before insert on public.branches
for each row execute function public.assign_automatic_code();
create trigger teams_automatic_code before insert on public.teams
for each row execute function public.assign_automatic_code();
create trigger employees_automatic_code before insert on public.employees
for each row execute function public.assign_automatic_employee_code();
create trigger shift_templates_automatic_code before insert on public.shift_templates
for each row execute function public.assign_automatic_code();
create trigger payroll_periods_automatic_code before insert on public.payroll_periods
for each row execute function public.assign_automatic_code();
create trigger bonus_policies_automatic_code before insert on public.bonus_policies
for each row execute function public.assign_automatic_code();
create trigger sales_targets_automatic_code before insert on public.sales_targets
for each row execute function public.assign_automatic_code();
create trigger attendance_devices_automatic_code before insert on public.attendance_devices
for each row execute function public.assign_automatic_code();

create or replace function public.create_attendance_device(
  p_tenant_id uuid, p_branch_id uuid, p_code text, p_name text, p_provider text,
  p_model text, p_serial_number text, p_connection_mode text, p_timezone text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if coalesce(auth.role(),'') <> 'service_role' and not public.has_permission(p_tenant_id,'attendance.manage') then
    raise exception 'Not authorized to configure attendance devices';
  end if;
  if coalesce(length(trim(p_name)),0) < 2 then raise exception 'Device name is required'; end if;
  if nullif(trim(coalesce(p_code,'')),'') is not null and upper(trim(p_code)) !~ '^[A-Z0-9_-]{2,40}$' then
    raise exception 'Device code must use letters, numbers, dash, or underscore';
  end if;
  if coalesce(p_connection_mode,'') not in ('file','api','database','sdk') then raise exception 'Unsupported attendance connection mode'; end if;
  insert into public.attendance_devices(tenant_id,branch_id,code,name,provider,model,serial_number,connection_mode,timezone,created_by)
  values(p_tenant_id,p_branch_id,upper(nullif(trim(coalesce(p_code,'')),'')),trim(p_name),coalesce(nullif(trim(p_provider),''),'generic'),
    nullif(trim(coalesce(p_model,'')),''),nullif(trim(coalesce(p_serial_number,'')),''),p_connection_mode,p_timezone,auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

comment on function public.next_tenant_entity_code(uuid,text) is
  'Generates tenant-scoped human-readable codes under an advisory transaction lock.';

create table public.employee_managers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  manager_employee_id uuid not null references public.employees(id) on delete cascade,
  is_primary boolean not null default false,
  effective_from date not null default current_date,
  effective_to date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (employee_id <> manager_employee_id),
  check (effective_to is null or effective_to >= effective_from)
);

create unique index employee_managers_active_unique
  on public.employee_managers(employee_id, manager_employee_id)
  where effective_to is null;
create unique index employee_managers_primary_unique
  on public.employee_managers(employee_id)
  where effective_to is null and is_primary;
create index employee_managers_manager_idx
  on public.employee_managers(tenant_id, manager_employee_id, effective_to);

create or replace function public.validate_employee_manager_links()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.employees e where e.id = new.employee_id and e.tenant_id = new.tenant_id) then
    raise exception 'Employee manager assignment uses an invalid employee';
  end if;
  if not exists (select 1 from public.employees e where e.id = new.manager_employee_id and e.tenant_id = new.tenant_id and e.status <> 'terminated') then
    raise exception 'Manager must be an active employee in the same company';
  end if;
  return new;
end;
$$;

create trigger validate_employee_managers
before insert or update on public.employee_managers
for each row execute function public.validate_employee_manager_links();

insert into public.employee_managers(tenant_id, employee_id, manager_employee_id, is_primary, effective_from, created_by)
select e.tenant_id, e.id, e.manager_employee_id, true, coalesce(e.hire_date, current_date), null
from public.employees e
where e.manager_employee_id is not null
on conflict do nothing;

create or replace function public.is_employee_manager(p_employee_id uuid, p_manager_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.employee_managers em
    where em.employee_id = p_employee_id
      and em.manager_employee_id = p_manager_employee_id
      and em.effective_to is null
  ) or exists (
    select 1 from public.employees e
    where e.id = p_employee_id and e.manager_employee_id = p_manager_employee_id
  );
$$;

create or replace function public.set_employee_managers(p_employee_id uuid, p_manager_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee public.employees%rowtype;
  v_manager_ids uuid[];
  v_primary uuid;
begin
  select * into v_employee from public.employees where id = p_employee_id for update;
  if v_employee.id is null then raise exception 'Employee not found'; end if;
  if not public.has_permission(v_employee.tenant_id, 'employees.manage') and not public.is_tenant_owner(v_employee.tenant_id) then
    raise exception 'Not authorized to assign employee managers';
  end if;

  select coalesce(array_agg(manager_id order by first_position), '{}'::uuid[]) into v_manager_ids
  from (
    select manager_id, min(position) as first_position
    from unnest(coalesce(p_manager_ids, '{}'::uuid[])) with ordinality as requested(manager_id, position)
    group by manager_id
  ) ordered_managers;
  if cardinality(v_manager_ids) > 10 then raise exception 'An employee can have up to 10 managers'; end if;
  if p_employee_id = any(v_manager_ids) then raise exception 'An employee cannot manage themselves'; end if;
  if exists (
    select 1 from unnest(v_manager_ids) manager_id
    left join public.employees manager on manager.id = manager_id
      and manager.tenant_id = v_employee.tenant_id and manager.status <> 'terminated'
    where manager.id is null
  ) then raise exception 'Every manager must be an active employee in the same company'; end if;

  v_primary := v_manager_ids[1];
  update public.employee_managers
    set effective_to = greatest(effective_from, current_date), is_primary = false
  where employee_id = p_employee_id and effective_to is null
    and not (manager_employee_id = any(v_manager_ids));

  update public.employee_managers
  set is_primary = false
  where employee_id = p_employee_id and effective_to is null and is_primary;

  insert into public.employee_managers(tenant_id, employee_id, manager_employee_id, is_primary, effective_from, created_by)
  select v_employee.tenant_id, p_employee_id, manager_id, manager_id = v_primary, current_date, auth.uid()
  from unnest(v_manager_ids) manager_id
  on conflict (employee_id, manager_employee_id) where effective_to is null
  do update set is_primary = excluded.is_primary;

  update public.employee_managers
  set is_primary = manager_employee_id = v_primary
  where employee_id = p_employee_id and effective_to is null;

  update public.employees
  set manager_employee_id = v_primary
  where id = p_employee_id and manager_employee_id is distinct from v_primary;
  return cardinality(v_manager_ids);
end;
$$;

create or replace function public.set_team_members(p_team_id uuid, p_employee_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team public.teams%rowtype;
  v_employee_ids uuid[];
  v_updated integer := 0;
  v_changed integer := 0;
begin
  select * into v_team from public.teams where id = p_team_id and is_active for update;
  if v_team.id is null then raise exception 'Active team not found'; end if;
  if not public.is_tenant_owner(v_team.tenant_id) and not (
    public.has_permission(v_team.tenant_id, 'teams.manage') and public.has_permission(v_team.tenant_id, 'employees.manage')
  ) then raise exception 'Not authorized to manage team members'; end if;

  select coalesce(array_agg(distinct employee_id), '{}'::uuid[]) into v_employee_ids
  from unnest(coalesce(p_employee_ids, '{}'::uuid[])) employee_id;
  if exists (
    select 1 from unnest(v_employee_ids) employee_id
    left join public.employees e on e.id = employee_id and e.tenant_id = v_team.tenant_id and e.status <> 'terminated'
    where e.id is null
  ) then raise exception 'Every selected person must be an active employee in the same company'; end if;
  if v_team.branch_id is not null and exists (
    select 1 from public.employees e
    where e.id = any(v_employee_ids) and e.branch_id is not null and e.branch_id <> v_team.branch_id
  ) then raise exception 'A branch team can only contain employees from that branch or employees without a branch'; end if;

  update public.employees set team_id = null
  where tenant_id = v_team.tenant_id and team_id = v_team.id and not (id = any(v_employee_ids));
  get diagnostics v_changed = row_count; v_updated := v_updated + v_changed;
  update public.employees set team_id = v_team.id
  where tenant_id = v_team.tenant_id and id = any(v_employee_ids) and team_id is distinct from v_team.id;
  get diagnostics v_changed = row_count; v_updated := v_updated + v_changed;
  return v_updated;
end;
$$;

create or replace function public.request_step_actor_users(p_step_id uuid, p_request_id uuid)
returns table(user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  with context as (
    select s.approver_kind, s.role_id, r.tenant_id, r.employee_id
    from public.approval_workflow_steps s
    join public.hr_requests r on r.id = p_request_id and r.workflow_id = s.workflow_id
    where s.id = p_step_id
  )
  select distinct resolved.user_id
  from (
    select manager.user_id
    from context c
    join public.employee_managers em on em.employee_id = c.employee_id and em.effective_to is null
    join public.employees manager on manager.id = em.manager_employee_id
    where c.approver_kind = 'manager' and manager.user_id is not null
    union all
    select manager.user_id
    from context c
    join public.employees employee on employee.id = c.employee_id
    join public.employees manager on manager.id = employee.manager_employee_id
    where c.approver_kind = 'manager' and manager.user_id is not null
    union all
    select m.user_id from context c join public.memberships m on m.tenant_id = c.tenant_id and m.status = 'active'
    where c.approver_kind = 'owner' and m.is_owner
    union all
    select m.user_id from context c join public.memberships m on m.tenant_id = c.tenant_id and m.status = 'active'
    join public.membership_roles mr on mr.membership_id = m.id join public.roles role on role.id = mr.role_id
    where c.approver_kind = 'hr' and role.name = 'hr_admin'
    union all
    select m.user_id from context c join public.memberships m on m.tenant_id = c.tenant_id and m.status = 'active'
    join public.membership_roles mr on mr.membership_id = m.id and mr.role_id = c.role_id
    where c.approver_kind = 'role'
  ) resolved where resolved.user_id is not null;
$$;

create or replace function public.leave_step_actor_users(p_step_id uuid, p_request_id uuid)
returns table(user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  with context as (
    select s.approver_kind, s.role_id, r.tenant_id, r.employee_id
    from public.approval_workflow_steps s
    join public.leave_requests r on r.id = p_request_id and r.workflow_id = s.workflow_id
    where s.id = p_step_id
  )
  select distinct resolved.user_id
  from (
    select manager.user_id
    from context c join public.employee_managers em on em.employee_id = c.employee_id and em.effective_to is null
    join public.employees manager on manager.id = em.manager_employee_id
    where c.approver_kind = 'manager' and manager.user_id is not null
    union all
    select manager.user_id from context c join public.employees employee on employee.id = c.employee_id
    join public.employees manager on manager.id = employee.manager_employee_id
    where c.approver_kind = 'manager' and manager.user_id is not null
    union all
    select m.user_id from context c join public.memberships m on m.tenant_id = c.tenant_id and m.status = 'active'
    where c.approver_kind = 'owner' and m.is_owner
    union all
    select m.user_id from context c join public.memberships m on m.tenant_id = c.tenant_id and m.status = 'active'
    join public.membership_roles mr on mr.membership_id = m.id join public.roles role on role.id = mr.role_id
    where c.approver_kind = 'hr' and role.name = 'hr_admin'
    union all
    select m.user_id from context c join public.memberships m on m.tenant_id = c.tenant_id and m.status = 'active'
    join public.membership_roles mr on mr.membership_id = m.id and mr.role_id = c.role_id
    where c.approver_kind = 'role'
  ) resolved where resolved.user_id is not null;
$$;

update public.permissions set description = 'View the company profile, identity, timezone, and operating settings'
where key = 'tenant.read';
update public.permissions set description = 'Edit the company profile and core company-wide settings'
where key = 'tenant.update';

create trigger audit_employee_managers
after insert or update or delete on public.employee_managers
for each row execute function public.capture_audit_log();

alter table public.employee_managers enable row level security;
create policy employee_managers_read on public.employee_managers for select to authenticated using (
  public.has_permission(tenant_id, 'employee_assignments.read')
  or employee_id = public.current_employee_id(tenant_id)
  or manager_employee_id = public.current_employee_id(tenant_id)
);
create policy employee_managers_manage on public.employee_managers for all to authenticated using (
  public.has_permission(tenant_id, 'employees.manage')
) with check (public.has_permission(tenant_id, 'employees.manage'));

grant select on public.employee_managers to authenticated;
grant all on public.employee_managers to service_role;
revoke execute on function public.next_tenant_entity_code(uuid,text), public.assign_automatic_code(), public.assign_automatic_employee_code(), public.validate_employee_manager_links() from public, anon, authenticated;
revoke execute on function public.is_employee_manager(uuid,uuid), public.set_employee_managers(uuid,uuid[]), public.set_team_members(uuid,uuid[]) from public, anon;
grant execute on function public.is_employee_manager(uuid,uuid), public.set_employee_managers(uuid,uuid[]), public.set_team_members(uuid,uuid[]) to authenticated;

comment on table public.employee_managers is 'Effective-dated multi-manager relationships; the primary manager remains mirrored on employees for backward compatibility.';

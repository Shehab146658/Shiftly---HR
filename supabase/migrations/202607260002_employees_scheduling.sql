-- Shiftly HR Milestone 2: employee lifecycle, assignment history, shift templates, and weekly scheduling.

create type public.schedule_status as enum ('draft', 'published', 'locked', 'archived');
create type public.schedule_entry_type as enum ('shift', 'off', 'leave', 'training', 'assignment');
create type public.schedule_visibility as enum ('self', 'team', 'branch', 'all');

alter table public.branches
  add column operational_day_start time not null default '06:00',
  add column maximum_shift_hours integer not null default 16 check (maximum_shift_hours between 1 and 24),
  add column week_start_isodow smallint not null default 1 check (week_start_isodow between 1 and 7),
  add column default_schedule_visibility public.schedule_visibility not null default 'self';

alter table public.employees
  add column email text,
  add column phone text,
  add column preferred_locale text not null default 'en' check (preferred_locale in ('en', 'ar')),
  add column notes text;

create unique index employees_tenant_email_unique
  on public.employees(tenant_id, lower(email))
  where email is not null;

create table public.employee_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  manager_employee_id uuid references public.employees(id) on delete set null,
  position text,
  effective_from date not null,
  effective_to date,
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from)
);

create unique index employee_assignments_current_unique
  on public.employee_assignments(employee_id)
  where effective_to is null;
create index employee_assignments_tenant_employee_idx
  on public.employee_assignments(tenant_id, employee_id, effective_from desc);

insert into public.employee_assignments(
  tenant_id, employee_id, branch_id, team_id, manager_employee_id, position,
  effective_from, reason
)
select
  e.tenant_id, e.id, e.branch_id, e.team_id, e.manager_employee_id, e.position,
  coalesce(e.hire_date, e.created_at::date), 'Milestone 2 assignment-history backfill'
from public.employees e
on conflict do nothing;

create table public.shift_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  code text not null check (code ~ '^[A-Z0-9_-]{2,30}$'),
  name_en text not null check (length(trim(name_en)) between 2 and 150),
  name_ar text,
  start_time time not null,
  end_time time not null,
  end_day_offset smallint not null default 0 check (end_day_offset in (0, 1)),
  break_minutes integer not null default 0 check (break_minutes between 0 and 480),
  color_hex text check (color_hex is null or color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code),
  check (end_day_offset = 1 or end_time > start_time)
);

create table public.weekly_schedules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  week_start date not null,
  status public.schedule_status not null default 'draft',
  visibility public.schedule_visibility not null default 'self',
  notes text,
  published_at timestamptz,
  published_by uuid references auth.users(id) on delete set null,
  locked_at timestamptz,
  locked_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, branch_id, week_start)
);

create table public.schedule_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  schedule_id uuid not null references public.weekly_schedules(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  scheduled_branch_id uuid not null references public.branches(id) on delete restrict,
  work_date date not null,
  segment_no smallint not null default 1 check (segment_no between 1 and 10),
  entry_type public.schedule_entry_type not null default 'shift',
  shift_template_id uuid references public.shift_templates(id) on delete restrict,
  custom_start_time time,
  custom_end_time time,
  end_day_offset smallint not null default 0 check (end_day_offset in (0, 1)),
  break_minutes integer not null default 0 check (break_minutes between 0 and 480),
  position_label text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (schedule_id, employee_id, work_date, segment_no),
  check (
    (entry_type = 'shift' and (
      (shift_template_id is not null and custom_start_time is null and custom_end_time is null)
      or
      (shift_template_id is null and custom_start_time is not null and custom_end_time is not null)
    ))
    or
    (entry_type <> 'shift' and shift_template_id is null and custom_start_time is null and custom_end_time is null and end_day_offset = 0 and break_minutes = 0)
  ),
  check (custom_start_time is null or end_day_offset = 1 or custom_end_time > custom_start_time)
);

create table public.schedule_status_events (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  schedule_id uuid not null references public.weekly_schedules(id) on delete cascade,
  from_status public.schedule_status,
  to_status public.schedule_status not null,
  reason text,
  actor_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index shift_templates_tenant_branch_idx on public.shift_templates(tenant_id, branch_id, is_active);
create index weekly_schedules_tenant_week_idx on public.weekly_schedules(tenant_id, week_start desc, branch_id);
create index schedule_entries_schedule_date_idx on public.schedule_entries(schedule_id, work_date, employee_id);
create index schedule_entries_employee_date_idx on public.schedule_entries(employee_id, work_date desc);
create index schedule_status_events_schedule_idx on public.schedule_status_events(schedule_id, created_at desc);

insert into public.permissions(key, description, module) values
  ('employee_assignments.read', 'View employee assignment history', 'employees'),
  ('shifts.read', 'View shift templates', 'scheduling'),
  ('shifts.manage', 'Create and maintain shift templates', 'scheduling'),
  ('schedules.read', 'View permitted weekly schedules', 'scheduling'),
  ('schedules.read_all', 'View all schedules in the tenant', 'scheduling'),
  ('schedules.manage', 'Create and edit draft schedules', 'scheduling'),
  ('schedules.publish', 'Publish and lock schedules', 'scheduling'),
  ('schedules.unlock', 'Reopen published or locked schedules with a reason', 'scheduling')
on conflict (key) do nothing;

-- Existing system roles receive the new scheduling permissions.
insert into public.role_permissions(role_id, permission_key)
select r.id, p.key
from public.roles r
cross join public.permissions p
where r.name = 'owner'
  and p.key in ('employee_assignments.read', 'shifts.read', 'shifts.manage', 'schedules.read', 'schedules.read_all', 'schedules.manage', 'schedules.publish', 'schedules.unlock')
on conflict do nothing;

insert into public.role_permissions(role_id, permission_key)
select r.id, p.key
from public.roles r
cross join public.permissions p
where r.name = 'hr_admin'
  and p.key in ('employee_assignments.read', 'shifts.read', 'shifts.manage', 'schedules.read', 'schedules.read_all', 'schedules.manage', 'schedules.publish', 'schedules.unlock')
on conflict do nothing;

insert into public.role_permissions(role_id, permission_key)
select r.id, p.key
from public.roles r
cross join public.permissions p
where r.name in ('branch_manager', 'team_manager')
  and p.key in ('employee_assignments.read', 'shifts.read', 'schedules.read', 'schedules.manage', 'schedules.publish')
on conflict do nothing;

insert into public.role_permissions(role_id, permission_key)
select r.id, p.key
from public.roles r
cross join public.permissions p
where r.name = 'employee'
  and p.key in ('shifts.read', 'schedules.read')
on conflict do nothing;

-- Ensure new tenants receive Milestone 2 permissions through the existing default-role function.
create or replace function public.seed_default_roles(p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_hr uuid;
  v_payroll uuid;
  v_accountant uuid;
  v_branch_manager uuid;
  v_team_manager uuid;
  v_employee uuid;
begin
  insert into public.roles(tenant_id, name, description, is_system) values
    (p_tenant_id, 'owner', 'Full tenant ownership and configuration', true),
    (p_tenant_id, 'hr_admin', 'Human resources administration', true),
    (p_tenant_id, 'payroll_officer', 'Payroll processing access', true),
    (p_tenant_id, 'accountant', 'Payroll and financial review', true),
    (p_tenant_id, 'branch_manager', 'Branch-scoped people management', true),
    (p_tenant_id, 'team_manager', 'Team-scoped people management', true),
    (p_tenant_id, 'employee', 'Employee self-service access', true)
  on conflict (tenant_id, name) do nothing;

  select id into v_owner from public.roles where tenant_id = p_tenant_id and name = 'owner';
  select id into v_hr from public.roles where tenant_id = p_tenant_id and name = 'hr_admin';
  select id into v_payroll from public.roles where tenant_id = p_tenant_id and name = 'payroll_officer';
  select id into v_accountant from public.roles where tenant_id = p_tenant_id and name = 'accountant';
  select id into v_branch_manager from public.roles where tenant_id = p_tenant_id and name = 'branch_manager';
  select id into v_team_manager from public.roles where tenant_id = p_tenant_id and name = 'team_manager';
  select id into v_employee from public.roles where tenant_id = p_tenant_id and name = 'employee';

  insert into public.role_permissions(role_id, permission_key)
    select v_owner, key from public.permissions on conflict do nothing;

  insert into public.role_permissions(role_id, permission_key) values
    (v_hr, 'tenant.read'), (v_hr, 'memberships.read'), (v_hr, 'memberships.manage'),
    (v_hr, 'roles.read'), (v_hr, 'branches.read'), (v_hr, 'branches.manage'),
    (v_hr, 'teams.read'), (v_hr, 'teams.manage'), (v_hr, 'employees.read'),
    (v_hr, 'employees.manage'), (v_hr, 'employee_assignments.read'),
    (v_hr, 'audit.read'), (v_hr, 'settings.manage'),
    (v_hr, 'shifts.read'), (v_hr, 'shifts.manage'), (v_hr, 'schedules.read'),
    (v_hr, 'schedules.read_all'), (v_hr, 'schedules.manage'), (v_hr, 'schedules.publish'), (v_hr, 'schedules.unlock'),
    (v_payroll, 'tenant.read'), (v_payroll, 'employees.read'), (v_payroll, 'payroll.read'), (v_payroll, 'payroll.manage'),
    (v_accountant, 'tenant.read'), (v_accountant, 'employees.read'), (v_accountant, 'payroll.read'),
    (v_branch_manager, 'tenant.read'), (v_branch_manager, 'branches.read'), (v_branch_manager, 'teams.read'),
    (v_branch_manager, 'employees.read'), (v_branch_manager, 'employees.manage'), (v_branch_manager, 'employee_assignments.read'),
    (v_branch_manager, 'shifts.read'), (v_branch_manager, 'schedules.read'),
    (v_branch_manager, 'schedules.manage'), (v_branch_manager, 'schedules.publish'),
    (v_team_manager, 'tenant.read'), (v_team_manager, 'branches.read'), (v_team_manager, 'teams.read'),
    (v_team_manager, 'employees.read'), (v_team_manager, 'employee_assignments.read'), (v_team_manager, 'shifts.read'),
    (v_team_manager, 'schedules.read'), (v_team_manager, 'schedules.manage'),
    (v_team_manager, 'schedules.publish'),
    (v_employee, 'tenant.read'), (v_employee, 'branches.read'), (v_employee, 'teams.read'),
    (v_employee, 'shifts.read'), (v_employee, 'schedules.read')
  on conflict do nothing;
end;
$$;

create trigger shift_templates_updated_at
before update on public.shift_templates
for each row execute function public.set_updated_at();

create trigger weekly_schedules_updated_at
before update on public.weekly_schedules
for each row execute function public.set_updated_at();

create trigger schedule_entries_updated_at
before update on public.schedule_entries
for each row execute function public.set_updated_at();

create or replace function public.validate_employee_assignment_links()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.employees e where e.id = new.employee_id and e.tenant_id = new.tenant_id
  ) then
    raise exception 'Assignment employee must belong to the same tenant';
  end if;
  if new.branch_id is not null and not exists (
    select 1 from public.branches b where b.id = new.branch_id and b.tenant_id = new.tenant_id
  ) then
    raise exception 'Assignment branch must belong to the same tenant';
  end if;
  if new.team_id is not null and not exists (
    select 1 from public.teams t
    where t.id = new.team_id and t.tenant_id = new.tenant_id
      and (new.branch_id is null or t.branch_id is null or t.branch_id = new.branch_id)
  ) then
    raise exception 'Assignment team must belong to the same tenant and branch';
  end if;
  if new.manager_employee_id is not null and not exists (
    select 1 from public.employees e where e.id = new.manager_employee_id and e.tenant_id = new.tenant_id
  ) then
    raise exception 'Assignment manager must belong to the same tenant';
  end if;
  return new;
end;
$$;

create trigger validate_employee_assignment
before insert or update on public.employee_assignments
for each row execute function public.validate_employee_assignment_links();

create or replace function public.track_employee_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_effective_from date;
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.employee_assignments a where a.employee_id = new.id and a.effective_to is null) then
      insert into public.employee_assignments(
        tenant_id, employee_id, branch_id, team_id, manager_employee_id, position,
        effective_from, reason, created_by
      ) values (
        new.tenant_id, new.id, new.branch_id, new.team_id, new.manager_employee_id, new.position,
        coalesce(new.hire_date, current_date), 'Initial employee assignment', auth.uid()
      );
    end if;
    return new;
  end if;

  v_effective_from := current_date;

  if new.status = 'terminated' and old.status <> 'terminated' then
    update public.employee_assignments
      set effective_to = greatest(effective_from, v_effective_from),
          reason = 'Employee archived'
    where employee_id = new.id and effective_to is null;
    return new;
  end if;

  if new.status <> 'terminated' and (
       old.status = 'terminated'
       or new.branch_id is distinct from old.branch_id
       or new.team_id is distinct from old.team_id
       or new.manager_employee_id is distinct from old.manager_employee_id
       or new.position is distinct from old.position
     ) then
    update public.employee_assignments
      set effective_to = greatest(effective_from, v_effective_from)
    where employee_id = new.id and effective_to is null;

    insert into public.employee_assignments(
      tenant_id, employee_id, branch_id, team_id, manager_employee_id, position,
      effective_from, reason, created_by
    ) values (
      new.tenant_id, new.id, new.branch_id, new.team_id, new.manager_employee_id, new.position,
      v_effective_from,
      case when old.status = 'terminated' then 'Employee reactivated' else 'Employee record updated' end,
      auth.uid()
    );
  end if;
  return new;
end;
$$;

create trigger track_employee_assignment_after_change
after insert or update on public.employees
for each row execute function public.track_employee_assignment();

create or replace function public.shift_duration_minutes(
  p_start_time time,
  p_end_time time,
  p_end_day_offset smallint
)
returns integer
language sql
immutable
set search_path = ''
as $$
  select (
    extract(epoch from (
      (date '2000-01-01' + p_end_time + (p_end_day_offset * interval '1 day'))
      - (date '2000-01-01' + p_start_time)
    )) / 60
  )::integer;
$$;

create or replace function public.validate_shift_template_links()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_duration_minutes integer;
  v_maximum_shift_hours integer;
begin
  v_duration_minutes := public.shift_duration_minutes(new.start_time, new.end_time, new.end_day_offset);
  if v_duration_minutes <= 0 then
    raise exception 'Shift duration must be greater than zero';
  end if;
  if new.break_minutes >= v_duration_minutes then
    raise exception 'Break duration must be shorter than the shift';
  end if;
  if new.branch_id is not null and not exists (
    select 1 from public.branches b where b.id = new.branch_id and b.tenant_id = new.tenant_id
  ) then
    raise exception 'Shift branch must belong to the same tenant';
  end if;
  if new.branch_id is not null then
    select b.maximum_shift_hours into v_maximum_shift_hours
    from public.branches b
    where b.id = new.branch_id and b.tenant_id = new.tenant_id;
    if v_duration_minutes > v_maximum_shift_hours * 60 then
      raise exception 'Shift duration exceeds the branch maximum';
    end if;
  end if;
  return new;
end;
$$;

create trigger validate_shift_template
before insert or update on public.shift_templates
for each row execute function public.validate_shift_template_links();

create or replace function public.validate_weekly_schedule_links()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_week_start_isodow smallint;
begin
  select b.week_start_isodow into v_week_start_isodow
  from public.branches b
  where b.id = new.branch_id and b.tenant_id = new.tenant_id;
  if v_week_start_isodow is null then
    raise exception 'Schedule branch must belong to the same tenant';
  end if;
  if extract(isodow from new.week_start)::smallint <> v_week_start_isodow then
    raise exception 'Schedule week start does not match the branch week-start setting';
  end if;
  return new;
end;
$$;

create trigger validate_weekly_schedule
before insert or update on public.weekly_schedules
for each row execute function public.validate_weekly_schedule_links();

create or replace function public.validate_schedule_status_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and coalesce(auth.role(), '') <> 'service_role'
     and coalesce(current_setting('shiftly.schedule_transition', true), '') <> 'allowed' then
    raise exception 'Use the schedule status action to publish, lock, reopen, or archive a schedule';
  end if;
  return new;
end;
$$;

create trigger validate_schedule_status_transition_trigger
before update on public.weekly_schedules
for each row execute function public.validate_schedule_status_transition();

create or replace function public.validate_schedule_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_schedule public.weekly_schedules%rowtype;
  v_duration_minutes integer;
  v_maximum_shift_hours integer;
  v_start_time time;
  v_end_time time;
  v_end_day_offset smallint;
  v_break_minutes integer;
begin
  select * into v_schedule from public.weekly_schedules s where s.id = new.schedule_id;
  if v_schedule.id is null then raise exception 'Schedule not found'; end if;
  if v_schedule.tenant_id <> new.tenant_id then raise exception 'Entry tenant must match schedule tenant'; end if;
  if v_schedule.status <> 'draft' then raise exception 'Only draft schedules can be edited'; end if;
  if new.work_date < v_schedule.week_start or new.work_date > v_schedule.week_start + 6 then
    raise exception 'Entry date must be within the schedule week';
  end if;
  if not exists (
    select 1 from public.employees e where e.id = new.employee_id and e.tenant_id = new.tenant_id
  ) then raise exception 'Schedule employee must belong to the same tenant'; end if;
  if not exists (
    select 1 from public.branches b where b.id = new.scheduled_branch_id and b.tenant_id = new.tenant_id
  ) then raise exception 'Scheduled branch must belong to the same tenant'; end if;
  if new.scheduled_branch_id <> v_schedule.branch_id then
    raise exception 'Scheduled branch must match the weekly schedule branch';
  end if;
  if new.shift_template_id is not null and not exists (
    select 1 from public.shift_templates st
    where st.id = new.shift_template_id and st.tenant_id = new.tenant_id
      and (st.branch_id is null or st.branch_id = new.scheduled_branch_id)
  ) then raise exception 'Shift template is not valid for this tenant or branch'; end if;

  if new.entry_type = 'shift' then
    if new.shift_template_id is not null then
      select st.start_time, st.end_time, st.end_day_offset, st.break_minutes
        into v_start_time, v_end_time, v_end_day_offset, v_break_minutes
      from public.shift_templates st
      where st.id = new.shift_template_id;
    else
      v_start_time := new.custom_start_time;
      v_end_time := new.custom_end_time;
      v_end_day_offset := new.end_day_offset;
      v_break_minutes := new.break_minutes;
    end if;

    v_duration_minutes := public.shift_duration_minutes(v_start_time, v_end_time, v_end_day_offset);
    select b.maximum_shift_hours into v_maximum_shift_hours
    from public.branches b
    where b.id = new.scheduled_branch_id;

    if v_duration_minutes <= 0 then
      raise exception 'Shift duration must be greater than zero';
    end if;
    if v_break_minutes >= v_duration_minutes then
      raise exception 'Break duration must be shorter than the shift';
    end if;
    if v_duration_minutes > v_maximum_shift_hours * 60 then
      raise exception 'Shift duration exceeds the branch maximum';
    end if;
  end if;
  return new;
end;
$$;

create trigger validate_schedule_entry_before_write
before insert or update on public.schedule_entries
for each row execute function public.validate_schedule_entry();

create or replace function public.prevent_locked_schedule_entry_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.schedule_status;
begin
  select status into v_status from public.weekly_schedules where id = old.schedule_id;
  if v_status <> 'draft' then raise exception 'Only draft schedules can be edited'; end if;
  return old;
end;
$$;

create trigger prevent_locked_schedule_entry_delete_trigger
before delete on public.schedule_entries
for each row execute function public.prevent_locked_schedule_entry_delete();

create or replace function public.current_employee_id(p_tenant_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.id
  from public.employees e
  where e.tenant_id = p_tenant_id and e.user_id = auth.uid() and e.status <> 'terminated'
  limit 1;
$$;

create or replace function public.can_manage_schedule_branch(
  p_tenant_id uuid,
  p_branch_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_permission(p_tenant_id, 'schedules.manage')
    and (
      public.has_permission(p_tenant_id, 'schedules.read_all')
      or exists (
        select 1
        from public.employees e
        where e.tenant_id = p_tenant_id
          and e.user_id = auth.uid()
          and e.status <> 'terminated'
          and e.branch_id = p_branch_id
      )
    );
$$;

create or replace function public.can_manage_schedule(
  p_tenant_id uuid,
  p_schedule_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.weekly_schedules s
    where s.id = p_schedule_id
      and s.tenant_id = p_tenant_id
      and public.can_manage_schedule_branch(s.tenant_id, s.branch_id)
  );
$$;

create or replace function public.can_view_weekly_schedule(
  p_tenant_id uuid,
  p_schedule_id uuid,
  p_branch_id uuid,
  p_visibility public.schedule_visibility
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_current_employee uuid;
  v_current_branch uuid;
  v_current_team uuid;
begin
  if public.has_permission(p_tenant_id, 'schedules.read_all') then return true; end if;
  if not public.is_tenant_member(p_tenant_id) then return false; end if;
  if p_visibility = 'all' then return true; end if;

  v_current_employee := public.current_employee_id(p_tenant_id);
  if v_current_employee is null then return false; end if;
  select e.branch_id, e.team_id into v_current_branch, v_current_team
  from public.employees e where e.id = v_current_employee;

  if p_visibility = 'self' then
    return exists (
      select 1 from public.schedule_entries se
      where se.schedule_id = p_schedule_id and se.employee_id = v_current_employee
    );
  end if;
  if p_visibility = 'branch' then return v_current_branch = p_branch_id; end if;
  if p_visibility = 'team' then
    return v_current_team is not null and exists (
      select 1
      from public.schedule_entries se
      join public.employees target on target.id = se.employee_id
      where se.schedule_id = p_schedule_id and target.team_id = v_current_team
    );
  end if;
  return false;
end;
$$;

create or replace function public.can_view_schedule_entry(
  p_tenant_id uuid,
  p_schedule_id uuid,
  p_employee_id uuid,
  p_scheduled_branch_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_visibility public.schedule_visibility;
  v_current_employee uuid;
  v_current_branch uuid;
  v_current_team uuid;
  v_target_team uuid;
begin
  if public.has_permission(p_tenant_id, 'schedules.read_all') then
    return true;
  end if;

  select s.visibility into v_visibility from public.weekly_schedules s where s.id = p_schedule_id;
  if v_visibility = 'all' then return public.is_tenant_member(p_tenant_id); end if;

  v_current_employee := public.current_employee_id(p_tenant_id);
  if v_current_employee is null then return false; end if;
  if v_current_employee = p_employee_id then return true; end if;

  select e.branch_id, e.team_id into v_current_branch, v_current_team
  from public.employees e where e.id = v_current_employee;

  if v_visibility = 'branch' then
    return v_current_branch = p_scheduled_branch_id;
  end if;

  if v_visibility = 'team' then
    select e.team_id into v_target_team from public.employees e where e.id = p_employee_id;
    return v_current_team is not null and v_current_team = v_target_team;
  end if;

  return false;
end;
$$;

create or replace function public.set_weekly_schedule_status(
  p_schedule_id uuid,
  p_target_status public.schedule_status,
  p_reason text default null
)
returns public.weekly_schedules
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_schedule public.weekly_schedules%rowtype;
  v_original public.schedule_status;
begin
  select * into v_schedule from public.weekly_schedules where id = p_schedule_id for update;
  if v_schedule.id is null then raise exception 'Schedule not found'; end if;
  if not public.is_tenant_member(v_schedule.tenant_id) then raise exception 'Access denied'; end if;
  if not public.can_manage_schedule_branch(v_schedule.tenant_id, v_schedule.branch_id) then raise exception 'Schedule is outside the user scope'; end if;
  v_original := v_schedule.status;
  perform set_config('shiftly.schedule_transition', 'allowed', true);

  if p_target_status = 'published' then
    if not public.has_permission(v_schedule.tenant_id, 'schedules.publish') then raise exception 'Missing schedules.publish permission'; end if;
    if v_original <> 'draft' then raise exception 'Only draft schedules can be published'; end if;
    if not exists (select 1 from public.schedule_entries where schedule_id = p_schedule_id) then raise exception 'Cannot publish an empty schedule'; end if;
    update public.weekly_schedules
      set status = 'published', published_at = now(), published_by = auth.uid(), locked_at = null, locked_by = null
      where id = p_schedule_id returning * into v_schedule;
  elsif p_target_status = 'locked' then
    if not public.has_permission(v_schedule.tenant_id, 'schedules.publish') then raise exception 'Missing schedules.publish permission'; end if;
    if v_original <> 'published' then raise exception 'Only published schedules can be locked'; end if;
    update public.weekly_schedules
      set status = 'locked', locked_at = now(), locked_by = auth.uid()
      where id = p_schedule_id returning * into v_schedule;
  elsif p_target_status = 'draft' then
    if not public.has_permission(v_schedule.tenant_id, 'schedules.unlock') then raise exception 'Missing schedules.unlock permission'; end if;
    if v_original not in ('published', 'locked') then raise exception 'Only published or locked schedules can be reopened'; end if;
    if length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'A reopening reason of at least 5 characters is required'; end if;
    update public.weekly_schedules
      set status = 'draft', locked_at = null, locked_by = null
      where id = p_schedule_id returning * into v_schedule;
  elsif p_target_status = 'archived' then
    if not public.has_permission(v_schedule.tenant_id, 'schedules.publish') then raise exception 'Missing schedules.publish permission'; end if;
    if v_original = 'draft' then raise exception 'Draft schedules cannot be archived'; end if;
    update public.weekly_schedules set status = 'archived' where id = p_schedule_id returning * into v_schedule;
  else
    raise exception 'Unsupported schedule status transition';
  end if;

  insert into public.schedule_status_events(tenant_id, schedule_id, from_status, to_status, reason, actor_user_id)
  values (v_schedule.tenant_id, p_schedule_id, v_original, p_target_status, nullif(trim(coalesce(p_reason, '')), ''), auth.uid());

  return v_schedule;
end;
$$;

create or replace function public.copy_weekly_schedule(
  p_source_schedule_id uuid,
  p_target_week_start date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.weekly_schedules%rowtype;
  v_target_id uuid;
  v_day_offset integer;
begin
  select * into v_source from public.weekly_schedules where id = p_source_schedule_id;
  if v_source.id is null then raise exception 'Source schedule not found'; end if;
  if not public.can_manage_schedule_branch(v_source.tenant_id, v_source.branch_id) then raise exception 'Schedule is outside the user scope'; end if;
  if extract(isodow from p_target_week_start)::smallint <> (select b.week_start_isodow from public.branches b where b.id = v_source.branch_id) then
    raise exception 'Target week start does not match the branch week-start setting';
  end if;

  insert into public.weekly_schedules(tenant_id, branch_id, week_start, visibility, notes, created_by)
  values (v_source.tenant_id, v_source.branch_id, p_target_week_start, v_source.visibility,
          concat('Copied from week ', v_source.week_start::text), auth.uid())
  returning id into v_target_id;

  v_day_offset := p_target_week_start - v_source.week_start;
  insert into public.schedule_entries(
    tenant_id, schedule_id, employee_id, scheduled_branch_id, work_date, segment_no,
    entry_type, shift_template_id, custom_start_time, custom_end_time, end_day_offset,
    break_minutes, position_label, notes, created_by
  )
  select
    tenant_id, v_target_id, employee_id, scheduled_branch_id, work_date + v_day_offset,
    segment_no, entry_type, shift_template_id, custom_start_time, custom_end_time,
    end_day_offset, break_minutes, position_label, notes, auth.uid()
  from public.schedule_entries
  where schedule_id = p_source_schedule_id;

  return v_target_id;
end;
$$;

grant execute on function public.current_employee_id(uuid) to authenticated;
grant execute on function public.can_manage_schedule_branch(uuid, uuid) to authenticated;
grant execute on function public.can_manage_schedule(uuid, uuid) to authenticated;
grant execute on function public.can_view_weekly_schedule(uuid, uuid, uuid, public.schedule_visibility) to authenticated;
grant execute on function public.can_view_schedule_entry(uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.set_weekly_schedule_status(uuid, public.schedule_status, text) to authenticated;
grant execute on function public.copy_weekly_schedule(uuid, date) to authenticated;

revoke execute on function public.validate_employee_assignment_links() from public, anon, authenticated;
revoke execute on function public.track_employee_assignment() from public, anon, authenticated;
revoke execute on function public.shift_duration_minutes(time, time, smallint) from public, anon, authenticated;
revoke execute on function public.validate_shift_template_links() from public, anon, authenticated;
revoke execute on function public.validate_weekly_schedule_links() from public, anon, authenticated;
revoke execute on function public.validate_schedule_status_transition() from public, anon, authenticated;
revoke execute on function public.validate_schedule_entry() from public, anon, authenticated;
revoke execute on function public.prevent_locked_schedule_entry_delete() from public, anon, authenticated;
revoke execute on function public.seed_default_roles(uuid) from public, anon, authenticated;

create trigger audit_employee_assignments
after insert or update or delete on public.employee_assignments
for each row execute function public.capture_audit_log();
create trigger audit_shift_templates
after insert or update or delete on public.shift_templates
for each row execute function public.capture_audit_log();
create trigger audit_weekly_schedules
after insert or update or delete on public.weekly_schedules
for each row execute function public.capture_audit_log();
create trigger audit_schedule_entries
after insert or update or delete on public.schedule_entries
for each row execute function public.capture_audit_log();

alter table public.employee_assignments enable row level security;
alter table public.shift_templates enable row level security;
alter table public.weekly_schedules enable row level security;
alter table public.schedule_entries enable row level security;
alter table public.schedule_status_events enable row level security;

create policy employee_assignments_read on public.employee_assignments
for select to authenticated using (
  public.has_permission(tenant_id, 'employee_assignments.read')
  or employee_id = public.current_employee_id(tenant_id)
);
create policy employee_assignments_manage on public.employee_assignments
for all to authenticated using (public.has_permission(tenant_id, 'employees.manage'))
with check (public.has_permission(tenant_id, 'employees.manage'));

create policy shift_templates_read on public.shift_templates
for select to authenticated using (public.is_tenant_member(tenant_id));
create policy shift_templates_manage on public.shift_templates
for all to authenticated using (public.has_permission(tenant_id, 'shifts.manage'))
with check (public.has_permission(tenant_id, 'shifts.manage'));

create policy weekly_schedules_read on public.weekly_schedules
for select to authenticated using (
  public.can_view_weekly_schedule(tenant_id, id, branch_id, visibility)
);
create policy weekly_schedules_manage on public.weekly_schedules
for insert to authenticated with check (public.can_manage_schedule_branch(tenant_id, branch_id));
create policy weekly_schedules_update on public.weekly_schedules
for update to authenticated using (public.can_manage_schedule_branch(tenant_id, branch_id))
with check (public.can_manage_schedule_branch(tenant_id, branch_id));
create policy weekly_schedules_delete on public.weekly_schedules
for delete to authenticated using (public.can_manage_schedule_branch(tenant_id, branch_id) and status = 'draft');

create policy schedule_entries_read on public.schedule_entries
for select to authenticated using (
  public.can_view_schedule_entry(tenant_id, schedule_id, employee_id, scheduled_branch_id)
);
create policy schedule_entries_manage on public.schedule_entries
for all to authenticated using (public.can_manage_schedule(tenant_id, schedule_id))
with check (public.can_manage_schedule(tenant_id, schedule_id));

create policy schedule_status_events_read on public.schedule_status_events
for select to authenticated using (
  public.has_permission(tenant_id, 'schedules.read_all')
  or schedule_id in (
    select se.schedule_id from public.schedule_entries se
    where public.can_view_schedule_entry(se.tenant_id, se.schedule_id, se.employee_id, se.scheduled_branch_id)
  )
);

revoke insert, update, delete on public.schedule_status_events from anon, authenticated;

-- Shiftly HR Milestone 1: multi-tenancy, identity, RBAC, branches, teams, employees, and audit.

create extension if not exists pgcrypto with schema extensions;

create type public.tenant_status as enum ('trial', 'active', 'suspended', 'cancelled');
create type public.membership_status as enum ('invited', 'active', 'suspended', 'revoked');
create type public.employee_status as enum ('active', 'inactive', 'on_leave', 'terminated');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  locale text not null default 'en' check (locale in ('en', 'ar')),
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  name_en text not null check (length(trim(name_en)) between 2 and 150),
  name_ar text,
  status public.tenant_status not null default 'trial',
  timezone text not null default 'Africa/Cairo',
  default_locale text not null default 'en' check (default_locale in ('en', 'ar')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenant_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.permissions (
  key text primary key,
  description text not null,
  module text not null,
  created_at timestamptz not null default now()
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_key)
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status public.membership_status not null default 'invited',
  is_owner boolean not null default false,
  invited_by uuid references auth.users(id),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table public.membership_roles (
  membership_id uuid not null references public.memberships(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  assigned_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (membership_id, role_id)
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null check (code ~ '^[A-Z0-9_-]{2,30}$'),
  name_en text not null check (length(trim(name_en)) between 2 and 150),
  name_ar text,
  timezone text,
  address_text text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  geofence_radius_m integer check (geofence_radius_m is null or geofence_radius_m between 20 and 10000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  code text not null check (code ~ '^[A-Z0-9_-]{2,30}$'),
  name_en text not null check (length(trim(name_en)) between 2 and 150),
  name_ar text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  employee_code text not null check (employee_code ~ '^[A-Z0-9_-]{2,30}$'),
  name_en text not null check (length(trim(name_en)) between 2 and 150),
  name_ar text,
  position text,
  branch_id uuid references public.branches(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  manager_employee_id uuid references public.employees(id) on delete set null,
  status public.employee_status not null default 'active',
  hire_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, employee_code),
  unique (tenant_id, user_id)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  tenant_id uuid references public.tenants(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  request_id text,
  created_at timestamptz not null default now()
);

create index memberships_user_status_idx on public.memberships(user_id, status);
create index memberships_tenant_status_idx on public.memberships(tenant_id, status);
create index roles_tenant_idx on public.roles(tenant_id);
create index branches_tenant_idx on public.branches(tenant_id);
create index teams_tenant_branch_idx on public.teams(tenant_id, branch_id);
create index employees_tenant_status_idx on public.employees(tenant_id, status);
create index audit_logs_tenant_created_idx on public.audit_logs(tenant_id, created_at desc);

insert into public.permissions(key, description, module) values
  ('tenant.read', 'View company details', 'company'),
  ('tenant.update', 'Update company details and settings', 'company'),
  ('memberships.read', 'View company users and memberships', 'access'),
  ('memberships.manage', 'Invite, suspend, and assign company users', 'access'),
  ('roles.read', 'View roles and permission assignments', 'access'),
  ('roles.manage', 'Create roles and assign permissions', 'access'),
  ('branches.read', 'View branches', 'organization'),
  ('branches.manage', 'Create and update branches', 'organization'),
  ('teams.read', 'View teams', 'organization'),
  ('teams.manage', 'Create and update teams', 'organization'),
  ('employees.read', 'View employee records', 'employees'),
  ('employees.manage', 'Create and update employee records', 'employees'),
  ('audit.read', 'View tenant audit events', 'governance'),
  ('settings.manage', 'Manage tenant configuration', 'company'),
  ('payroll.read', 'View payroll information', 'payroll'),
  ('payroll.manage', 'Manage payroll information', 'payroll')
on conflict (key) do nothing;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger tenants_updated_at before update on public.tenants for each row execute function public.set_updated_at();
create trigger tenant_settings_updated_at before update on public.tenant_settings for each row execute function public.set_updated_at();
create trigger roles_updated_at before update on public.roles for each row execute function public.set_updated_at();
create trigger memberships_updated_at before update on public.memberships for each row execute function public.set_updated_at();
create trigger branches_updated_at before update on public.branches for each row execute function public.set_updated_at();
create trigger teams_updated_at before update on public.teams for each row execute function public.set_updated_at();
create trigger employees_updated_at before update on public.employees for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles(id, full_name, locale)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    case when new.raw_user_meta_data ->> 'locale' = 'ar' then 'ar' else 'en' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.is_platform_admin from public.profiles p where p.id = auth.uid()), false);
$$;

create or replace function public.is_tenant_member(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin() or exists (
    select 1 from public.memberships m
    where m.tenant_id = p_tenant_id and m.user_id = auth.uid() and m.status = 'active'
  );
$$;

create or replace function public.is_tenant_owner(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin() or exists (
    select 1 from public.memberships m
    where m.tenant_id = p_tenant_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.is_owner = true
  );
$$;

create or replace function public.has_permission(p_tenant_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin() or exists (
    select 1
    from public.memberships m
    join public.membership_roles mr on mr.membership_id = m.id
    join public.role_permissions rp on rp.role_id = mr.role_id
    where m.tenant_id = p_tenant_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and rp.permission_key = p_permission
  );
$$;

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
    (v_hr, 'employees.manage'), (v_hr, 'audit.read'), (v_hr, 'settings.manage'),
    (v_payroll, 'tenant.read'), (v_payroll, 'employees.read'), (v_payroll, 'payroll.read'), (v_payroll, 'payroll.manage'),
    (v_accountant, 'tenant.read'), (v_accountant, 'employees.read'), (v_accountant, 'payroll.read'),
    (v_branch_manager, 'tenant.read'), (v_branch_manager, 'branches.read'), (v_branch_manager, 'teams.read'),
    (v_branch_manager, 'employees.read'), (v_branch_manager, 'employees.manage'),
    (v_team_manager, 'tenant.read'), (v_team_manager, 'branches.read'), (v_team_manager, 'teams.read'), (v_team_manager, 'employees.read'),
    (v_employee, 'tenant.read'), (v_employee, 'branches.read'), (v_employee, 'teams.read')
  on conflict do nothing;
end;
$$;

create or replace function public.after_tenant_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.tenant_settings(tenant_id, settings)
  values (new.id, jsonb_build_object('attendance', jsonb_build_object('enabled_methods', jsonb_build_array('mobile'))))
  on conflict (tenant_id) do nothing;
  perform public.seed_default_roles(new.id);
  return new;
end;
$$;

create trigger tenant_defaults
after insert on public.tenants
for each row execute function public.after_tenant_insert();

create or replace function public.create_tenant_with_owner(
  p_name_en text,
  p_name_ar text,
  p_slug text,
  p_timezone text default 'Africa/Cairo'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_membership_id uuid;
  v_owner_role_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if length(trim(p_name_en)) < 2 then raise exception 'Company name is required'; end if;

  insert into public.tenants(slug, name_en, name_ar, timezone, created_by)
  values (lower(trim(p_slug)), trim(p_name_en), nullif(trim(p_name_ar), ''), coalesce(nullif(trim(p_timezone), ''), 'Africa/Cairo'), auth.uid())
  returning id into v_tenant_id;

  insert into public.memberships(tenant_id, user_id, status, is_owner, invited_by, joined_at)
  values (v_tenant_id, auth.uid(), 'active', true, auth.uid(), now())
  returning id into v_membership_id;

  select id into v_owner_role_id from public.roles where tenant_id = v_tenant_id and name = 'owner';
  insert into public.membership_roles(membership_id, role_id, assigned_by)
  values (v_membership_id, v_owner_role_id, auth.uid());

  return v_tenant_id;
end;
$$;

grant execute on function public.create_tenant_with_owner(text, text, text, text) to authenticated;
grant execute on function public.is_tenant_member(uuid) to authenticated;
grant execute on function public.has_permission(uuid, text) to authenticated;

create or replace function public.validate_team_branch_tenant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.branch_id is not null and not exists (
    select 1 from public.branches b where b.id = new.branch_id and b.tenant_id = new.tenant_id
  ) then
    raise exception 'Team branch must belong to the same tenant';
  end if;
  return new;
end;
$$;

create trigger validate_team_branch
before insert or update on public.teams
for each row execute function public.validate_team_branch_tenant();

create or replace function public.validate_employee_tenant_links()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.branch_id is not null and not exists (
    select 1 from public.branches b where b.id = new.branch_id and b.tenant_id = new.tenant_id
  ) then
    raise exception 'Employee branch must belong to the same tenant';
  end if;
  if new.team_id is not null and not exists (
    select 1 from public.teams t where t.id = new.team_id and t.tenant_id = new.tenant_id
  ) then
    raise exception 'Employee team must belong to the same tenant';
  end if;
  if new.manager_employee_id is not null and not exists (
    select 1 from public.employees e where e.id = new.manager_employee_id and e.tenant_id = new.tenant_id
  ) then
    raise exception 'Employee manager must belong to the same tenant';
  end if;
  return new;
end;
$$;

create trigger validate_employee_links
before insert or update on public.employees
for each row execute function public.validate_employee_tenant_links();

create or replace function public.validate_membership_owner_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_change boolean;
begin
  v_owner_change := case
    when tg_op = 'INSERT' then new.is_owner
    else new.is_owner is distinct from old.is_owner
  end;

  if v_owner_change then
    if coalesce(auth.role(), '') <> 'service_role'
      and not public.is_platform_admin()
      and not public.is_tenant_owner(new.tenant_id)
      and not (
        new.is_owner = true
        and exists (select 1 from public.tenants t where t.id = new.tenant_id and t.created_by = auth.uid())
        and not exists (select 1 from public.memberships m where m.tenant_id = new.tenant_id and m.is_owner = true)
      )
    then
      raise exception 'Only an existing owner can change owner status';
    end if;
  end if;
  return new;
end;
$$;

create trigger validate_membership_owner
before insert or update on public.memberships
for each row execute function public.validate_membership_owner_change();

create or replace function public.validate_membership_role_tenant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_role_name text;
  v_target_is_owner boolean;
begin
  select m.tenant_id, r.name, m.is_owner
    into v_tenant_id, v_role_name, v_target_is_owner
  from public.memberships m
  join public.roles r on r.id = new.role_id
  where m.id = new.membership_id and m.tenant_id = r.tenant_id;

  if v_tenant_id is null then
    raise exception 'Membership and role must belong to the same tenant';
  end if;

  if v_role_name = 'owner' then
    if not v_target_is_owner then
      raise exception 'Owner role requires owner membership status';
    end if;
    if coalesce(auth.role(), '') <> 'service_role'
      and not public.is_platform_admin()
      and not public.is_tenant_owner(v_tenant_id)
    then
      raise exception 'Only an existing owner can assign the owner role';
    end if;
  end if;
  return new;
end;
$$;

create trigger validate_membership_role
before insert or update on public.membership_roles
for each row execute function public.validate_membership_role_tenant();

create or replace function public.capture_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_tenant_id uuid;
  v_entity_id text;
begin
  v_old := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  v_new := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;

  if tg_table_name = 'tenants' then
    v_tenant_id := coalesce((v_new ->> 'id')::uuid, (v_old ->> 'id')::uuid);
  else
    v_tenant_id := coalesce((v_new ->> 'tenant_id')::uuid, (v_old ->> 'tenant_id')::uuid);
  end if;
  v_entity_id := coalesce(v_new ->> 'id', v_old ->> 'id', v_new ->> 'membership_id', v_old ->> 'membership_id');

  insert into public.audit_logs(tenant_id, actor_user_id, action, entity_type, entity_id, before_data, after_data)
  values (v_tenant_id, auth.uid(), lower(tg_op), tg_table_name, v_entity_id, v_old, v_new);
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger audit_tenants after insert or update or delete on public.tenants for each row execute function public.capture_audit_log();
create trigger audit_roles after insert or update or delete on public.roles for each row execute function public.capture_audit_log();
create trigger audit_memberships after insert or update or delete on public.memberships for each row execute function public.capture_audit_log();
create trigger audit_branches after insert or update or delete on public.branches for each row execute function public.capture_audit_log();
create trigger audit_teams after insert or update or delete on public.teams for each row execute function public.capture_audit_log();
create trigger audit_employees after insert or update or delete on public.employees for each row execute function public.capture_audit_log();

revoke execute on function public.seed_default_roles(uuid) from public, anon, authenticated;
revoke execute on function public.after_tenant_insert() from public, anon, authenticated;
revoke execute on function public.capture_audit_log() from public, anon, authenticated;
revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.validate_team_branch_tenant() from public, anon, authenticated;
revoke execute on function public.validate_employee_tenant_links() from public, anon, authenticated;
revoke execute on function public.validate_membership_role_tenant() from public, anon, authenticated;
revoke execute on function public.validate_membership_owner_change() from public, anon, authenticated;
revoke execute on function public.is_tenant_owner(uuid) from public, anon, authenticated;

alter table public.profiles enable row level security;
alter table public.tenants enable row level security;
alter table public.tenant_settings enable row level security;
alter table public.permissions enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.memberships enable row level security;
alter table public.membership_roles enable row level security;
alter table public.branches enable row level security;
alter table public.teams enable row level security;
alter table public.employees enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_select_self on public.profiles for select to authenticated using (id = auth.uid() or public.is_platform_admin());
create policy profiles_update_self on public.profiles for update to authenticated using (id = auth.uid() or public.is_platform_admin()) with check (id = auth.uid() or public.is_platform_admin());

create policy tenants_select_member on public.tenants for select to authenticated using (public.is_tenant_member(id));
create policy tenants_update_permission on public.tenants for update to authenticated using (public.has_permission(id, 'tenant.update')) with check (public.has_permission(id, 'tenant.update'));

create policy tenant_settings_select_member on public.tenant_settings for select to authenticated using (public.is_tenant_member(tenant_id));
create policy tenant_settings_manage on public.tenant_settings for all to authenticated using (public.has_permission(tenant_id, 'settings.manage')) with check (public.has_permission(tenant_id, 'settings.manage'));

create policy permissions_read on public.permissions for select to authenticated using (true);

create policy roles_read on public.roles for select to authenticated using (public.has_permission(tenant_id, 'roles.read') or public.is_tenant_member(tenant_id));
create policy roles_manage on public.roles for all to authenticated using (public.has_permission(tenant_id, 'roles.manage')) with check (public.has_permission(tenant_id, 'roles.manage'));

create policy role_permissions_read on public.role_permissions for select to authenticated using (
  exists (select 1 from public.roles r where r.id = role_id and public.is_tenant_member(r.tenant_id))
);
create policy role_permissions_manage on public.role_permissions for all to authenticated using (
  exists (select 1 from public.roles r where r.id = role_id and public.has_permission(r.tenant_id, 'roles.manage'))
) with check (
  exists (select 1 from public.roles r where r.id = role_id and public.has_permission(r.tenant_id, 'roles.manage'))
);

create policy memberships_read on public.memberships for select to authenticated using (
  user_id = auth.uid() or public.has_permission(tenant_id, 'memberships.read')
);
create policy memberships_manage on public.memberships for all to authenticated using (public.has_permission(tenant_id, 'memberships.manage')) with check (public.has_permission(tenant_id, 'memberships.manage'));

create policy membership_roles_read on public.membership_roles for select to authenticated using (
  exists (select 1 from public.memberships m where m.id = membership_id and (m.user_id = auth.uid() or public.has_permission(m.tenant_id, 'memberships.read')))
);
create policy membership_roles_manage on public.membership_roles for all to authenticated using (
  exists (select 1 from public.memberships m where m.id = membership_id and public.has_permission(m.tenant_id, 'memberships.manage'))
) with check (
  exists (select 1 from public.memberships m where m.id = membership_id and public.has_permission(m.tenant_id, 'memberships.manage'))
);

create policy branches_read on public.branches for select to authenticated using (public.has_permission(tenant_id, 'branches.read') or public.is_tenant_member(tenant_id));
create policy branches_manage on public.branches for all to authenticated using (public.has_permission(tenant_id, 'branches.manage')) with check (public.has_permission(tenant_id, 'branches.manage'));

create policy teams_read on public.teams for select to authenticated using (public.has_permission(tenant_id, 'teams.read') or public.is_tenant_member(tenant_id));
create policy teams_manage on public.teams for all to authenticated using (public.has_permission(tenant_id, 'teams.manage')) with check (public.has_permission(tenant_id, 'teams.manage'));

create policy employees_read on public.employees for select to authenticated using (
  public.has_permission(tenant_id, 'employees.read') or user_id = auth.uid()
);
create policy employees_manage on public.employees for all to authenticated using (public.has_permission(tenant_id, 'employees.manage')) with check (public.has_permission(tenant_id, 'employees.manage'));

create policy audit_read on public.audit_logs for select to authenticated using (public.has_permission(tenant_id, 'audit.read'));

revoke insert, update, delete on public.audit_logs from anon, authenticated;

-- Authenticated users may edit only non-privileged profile fields. Platform-admin
-- assignment is a server-side/service-role operation.
revoke update on public.profiles from authenticated;
grant update (full_name, locale) on public.profiles to authenticated;

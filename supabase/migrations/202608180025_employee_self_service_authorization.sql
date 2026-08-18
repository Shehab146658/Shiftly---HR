-- Keep the built-in employee role focused on personal self-service. Company
-- structure is deliberately not exposed through the default employee role;
-- owners can still create a custom role when broader read access is wanted.

delete from public.role_permissions rp
using public.roles r
where r.id = rp.role_id
  and r.name = 'employee'
  and rp.permission_key in ('branches.read', 'teams.read', 'shifts.read');

-- Membership alone must not turn the organization directory into a public
-- company listing. Self-service users can still resolve their own branch/team,
-- and can resolve only the shift templates used by schedule rows they may see.
drop policy if exists branches_read on public.branches;
create policy branches_read on public.branches for select to authenticated
using (
  public.has_permission(tenant_id, 'branches.read')
  or exists (
    select 1 from public.employees e
    where e.tenant_id = branches.tenant_id
      and e.branch_id = branches.id
      and e.user_id = auth.uid()
      and e.status <> 'terminated'
  )
);

drop policy if exists teams_read on public.teams;
create policy teams_read on public.teams for select to authenticated
using (
  public.has_permission(tenant_id, 'teams.read')
  or exists (
    select 1 from public.employees e
    where e.tenant_id = teams.tenant_id
      and e.team_id = teams.id
      and e.user_id = auth.uid()
      and e.status <> 'terminated'
  )
);

drop policy if exists roles_read on public.roles;
create policy roles_read on public.roles for select to authenticated
using (
  public.has_permission(tenant_id, 'roles.read')
  or exists (
    select 1
    from public.membership_roles mr
    join public.memberships m on m.id = mr.membership_id
    where mr.role_id = roles.id
      and m.user_id = auth.uid()
      and m.tenant_id = roles.tenant_id
      and m.status = 'active'
  )
);

drop policy if exists shift_templates_read on public.shift_templates;
create policy shift_templates_read on public.shift_templates for select to authenticated
using (
  public.has_permission(tenant_id, 'shifts.read')
  or exists (
    select 1 from public.schedule_entries se
    where se.shift_template_id = shift_templates.id
      and public.can_view_schedule_entry(
        se.tenant_id,
        se.schedule_id,
        se.employee_id,
        se.scheduled_branch_id
      )
  )
);

create or replace function public.enforce_employee_self_service_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.name = 'employee' then
    delete from public.role_permissions
    where role_id = new.id
      and permission_key in ('branches.read', 'teams.read', 'shifts.read');
  end if;
  return new;
end;
$$;

-- PostgreSQL fires same-kind triggers alphabetically. The zz prefix makes this
-- final allow-list cleanup run after the foundation/scheduling grant triggers.
create trigger zz_enforce_employee_self_service_role_after_insert
after insert on public.roles
for each row execute function public.enforce_employee_self_service_role();

create or replace function public.enforce_employee_self_service_after_tenant_seed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.role_permissions rp
  using public.roles r
  where r.id = rp.role_id
    and r.tenant_id = new.id
    and r.name = 'employee'
    and rp.permission_key in ('branches.read', 'teams.read', 'shifts.read');
  return new;
end;
$$;

-- The foundation tenant trigger grants its base role permissions after role
-- insertion, so a final tenant trigger performs the same cleanup after seeding.
create trigger zz_enforce_employee_self_service_after_tenant_seed
after insert on public.tenants
for each row execute function public.enforce_employee_self_service_after_tenant_seed();

revoke execute on function public.enforce_employee_self_service_role()
from public, anon, authenticated;
revoke execute on function public.enforce_employee_self_service_after_tenant_seed()
from public, anon, authenticated;

-- Location is required evidence for every mobile punch. This is enforced in
-- the database as well as the UI so a crafted request cannot bypass it.
create or replace function public.require_mobile_attendance_location()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.source = 'mobile' and (new.latitude is null or new.longitude is null) then
    raise exception 'Precise location is required for mobile attendance';
  end if;
  return new;
end;
$$;

create trigger require_mobile_attendance_location_before_insert
before insert on public.attendance_punches
for each row execute function public.require_mobile_attendance_location();

revoke execute on function public.require_mobile_attendance_location()
from public, anon, authenticated;

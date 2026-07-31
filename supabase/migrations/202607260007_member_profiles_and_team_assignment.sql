-- Member profiles and safe company-wide team assignment.

create or replace function public.can_view_tenant_profile(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() = p_user_id
    or public.is_platform_admin()
    or exists (
      select 1
      from public.memberships viewer
      join public.memberships target on target.tenant_id = viewer.tenant_id
      where viewer.user_id = auth.uid()
        and viewer.status = 'active'
        and target.user_id = p_user_id
        and target.status in ('invited', 'active')
        and (
          viewer.is_owner = true
          or public.has_permission(viewer.tenant_id, 'memberships.read')
        )
    );
$$;

drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_tenant_members on public.profiles
for select to authenticated
using (public.can_view_tenant_profile(id));

create or replace function public.assign_all_employees_to_team(p_team_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_updated integer;
begin
  select t.tenant_id into v_tenant_id
  from public.teams t
  where t.id = p_team_id and t.is_active = true;

  if v_tenant_id is null then
    raise exception 'Active team not found';
  end if;

  if not public.is_tenant_owner(v_tenant_id)
     and not (
       public.has_permission(v_tenant_id, 'teams.manage')
       and public.has_permission(v_tenant_id, 'employees.manage')
     )
     and not public.is_platform_admin()
  then
    raise exception 'Not authorized to assign the company workforce';
  end if;

  -- A team containing people from several branches must be company-wide.
  update public.teams
  set branch_id = null
  where id = p_team_id and branch_id is not null;

  update public.employees
  set team_id = p_team_id
  where tenant_id = v_tenant_id
    and status <> 'terminated'
    and team_id is distinct from p_team_id;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke execute on function public.can_view_tenant_profile(uuid) from public, anon;
grant execute on function public.can_view_tenant_profile(uuid) to authenticated;
revoke execute on function public.assign_all_employees_to_team(uuid) from public, anon;
grant execute on function public.assign_all_employees_to_team(uuid) to authenticated;

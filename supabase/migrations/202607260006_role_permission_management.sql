-- Atomic, audited permission management for tenant roles.

create or replace function public.set_role_permissions(p_role_id uuid, p_permission_keys text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_role_name text;
  v_permission_keys text[] := coalesce(p_permission_keys, array[]::text[]);
  v_before jsonb;
  v_after jsonb;
begin
  select r.tenant_id, r.name into v_tenant_id, v_role_name
  from public.roles r
  where r.id = p_role_id;

  if v_tenant_id is null then
    raise exception 'Role not found';
  end if;

  if not public.has_permission(v_tenant_id, 'roles.manage')
     and not public.is_tenant_owner(v_tenant_id)
     and not public.is_platform_admin()
  then
    raise exception 'Not authorized to manage role permissions';
  end if;

  if v_role_name = 'owner' then
    raise exception 'Owner permissions are protected to prevent company lockout';
  end if;

  if exists (
    select 1
    from unnest(v_permission_keys) requested(permission_key)
    left join public.permissions p on p.key = requested.permission_key
    where p.key is null
  ) then
    raise exception 'One or more permissions are invalid';
  end if;

  select jsonb_build_object(
    'role_id', p_role_id,
    'role_name', v_role_name,
    'permission_keys', coalesce(jsonb_agg(rp.permission_key order by rp.permission_key), '[]'::jsonb)
  ) into v_before
  from public.role_permissions rp
  where rp.role_id = p_role_id;

  delete from public.role_permissions rp
  where rp.role_id = p_role_id
    and not (rp.permission_key = any(v_permission_keys));

  insert into public.role_permissions(role_id, permission_key)
  select p_role_id, requested.permission_key
  from (select distinct unnest(v_permission_keys) as permission_key) requested
  on conflict (role_id, permission_key) do nothing;

  select jsonb_build_object(
    'role_id', p_role_id,
    'role_name', v_role_name,
    'permission_keys', coalesce(jsonb_agg(rp.permission_key order by rp.permission_key), '[]'::jsonb)
  ) into v_after
  from public.role_permissions rp
  where rp.role_id = p_role_id;

  if v_before is distinct from v_after then
    insert into public.audit_logs(tenant_id, actor_user_id, action, entity_type, entity_id, before_data, after_data)
    values (v_tenant_id, auth.uid(), 'update', 'role_permissions', p_role_id::text, v_before, v_after);
  end if;
end;
$$;

revoke execute on function public.set_role_permissions(uuid, text[]) from public, anon;
grant execute on function public.set_role_permissions(uuid, text[]) to authenticated;

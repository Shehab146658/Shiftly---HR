begin;
select plan(5);

select has_function('public', 'can_view_tenant_profile', array['uuid'], 'tenant profile visibility helper exists');
select has_function('public', 'assign_all_employees_to_team', array['uuid'], 'company-wide team assignment RPC exists');
select is(
  (select count(*)::integer from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_select_tenant_members'),
  1,
  'profiles expose a tenant-aware read policy'
);
select ok(
  has_function_privilege('authenticated', 'public.assign_all_employees_to_team(uuid)', 'EXECUTE'),
  'authenticated users can call the guarded assignment RPC'
);
select ok(
  not has_function_privilege('anon', 'public.assign_all_employees_to_team(uuid)', 'EXECUTE'),
  'anonymous users cannot call the assignment RPC'
);

select * from finish();
rollback;

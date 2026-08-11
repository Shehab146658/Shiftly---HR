begin;
select plan(7);

select has_function('public', 'grant_reporting_permissions_for_role', array[]::text[], 'reporting role grant function exists');
select has_trigger('public', 'roles', 'grant_reporting_permissions_after_role', 'new roles receive reporting permissions');
select results_eq(
  $$select count(*)::bigint from public.permissions where module = 'reports'$$,
  array[2::bigint],
  'reporting permission catalogue is complete'
);
insert into public.tenants(id,slug,name_en,status) values ('19000000-0000-0000-0000-000000000001','reporting-test','Reporting Test','active');
select ok(exists(select 1 from public.role_permissions rp join public.roles r on r.id=rp.role_id where r.tenant_id='19000000-0000-0000-0000-000000000001' and r.name='owner' and rp.permission_key='reports.read'), 'owner can read reports');
select ok(exists(select 1 from public.role_permissions rp join public.roles r on r.id=rp.role_id where r.tenant_id='19000000-0000-0000-0000-000000000001' and r.name='hr_admin' and rp.permission_key='reports.export'), 'HR can export reports');
select ok(exists(select 1 from public.role_permissions rp join public.roles r on r.id=rp.role_id where r.tenant_id='19000000-0000-0000-0000-000000000001' and r.name='branch_manager' and rp.permission_key='reports.read'), 'branch manager can read scoped reports');
select ok(not exists(select 1 from public.role_permissions rp join public.roles r on r.id=rp.role_id where r.tenant_id='19000000-0000-0000-0000-000000000001' and r.name='employee' and rp.permission_key like 'reports.%'), 'employee role does not receive executive reports');

select * from finish();
rollback;

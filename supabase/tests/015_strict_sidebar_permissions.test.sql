begin;
select plan(6);

select ok(
  exists(select 1 from public.permissions where key = 'payslips.read_own' and module = 'payroll'),
  'personal payslip navigation has a dedicated permission'
);

insert into public.tenants(id, slug, name_en, status)
values ('19000000-0000-0000-0000-000000000001', 'sidebar-test', 'Sidebar Test', 'active');

select is(
  (select count(*)::integer from public.role_permissions rp join public.roles r on r.id = rp.role_id where r.tenant_id = '19000000-0000-0000-0000-000000000001' and r.name = 'owner' and rp.permission_key = 'payslips.read_own'),
  1,
  'owners receive personal payslip navigation access'
);

select is(
  (select count(*)::integer from public.role_permissions rp join public.roles r on r.id = rp.role_id where r.tenant_id = '19000000-0000-0000-0000-000000000001' and r.name = 'branch_manager' and rp.permission_key = 'payslips.read_own'),
  1,
  'branch managers retain their personal payslip access'
);

select is(
  (select count(*)::integer from public.role_permissions rp join public.roles r on r.id = rp.role_id where r.tenant_id = '19000000-0000-0000-0000-000000000001' and r.name = 'team_manager' and rp.permission_key = 'payslips.read_own'),
  1,
  'team managers retain their personal payslip access'
);

select is(
  (select count(*)::integer from public.role_permissions rp join public.roles r on r.id = rp.role_id where r.tenant_id = '19000000-0000-0000-0000-000000000001' and r.name = 'employee' and rp.permission_key = 'payslips.read_own'),
  1,
  'employees receive only personal payslip navigation access'
);

select is(
  (select count(*)::integer from public.role_permissions rp join public.roles r on r.id = rp.role_id where r.tenant_id = '19000000-0000-0000-0000-000000000001' and r.name = 'employee' and rp.permission_key = 'payroll.read'),
  0,
  'employees do not receive company-wide payroll access'
);

select * from finish();
rollback;

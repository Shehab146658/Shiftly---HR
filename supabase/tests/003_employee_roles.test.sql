begin;
select plan(14);

select has_table('public', 'employee_role_assignments', 'employee role assignments exist');
select has_column('public', 'employee_role_assignments', 'tenant_id', 'role assignment stores its tenant');
select has_column('public', 'employee_role_assignments', 'employee_id', 'role assignment stores its employee');
select has_column('public', 'employee_role_assignments', 'role_id', 'role assignment stores its role');
select has_function('public', 'set_employee_roles', array['uuid','uuid[]'], 'employee role assignment RPC exists');
select ok(
  (select c.relrowsecurity from pg_catalog.pg_class c where c.oid = 'public.employee_role_assignments'::regclass),
  'RLS is enabled on employee role assignments'
);
select has_policy('public', 'employee_role_assignments', 'employee_role_assignments_read', 'employee role assignments have a read policy');
select has_policy('public', 'employee_role_assignments', 'employee_role_assignments_manage', 'employee role assignments have a write policy');

insert into public.tenants(id, slug, name_en, status)
values ('11000000-0000-0000-0000-000000000001', 'roles-test', 'Roles Test', 'active');

insert into public.employees(id, tenant_id, employee_code, name_en, status)
values ('31000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'ROLE-001', 'Role Tester', 'active');

select lives_ok(
  $$insert into public.employee_role_assignments(tenant_id, employee_id, role_id)
    select '11000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', id
    from public.roles where tenant_id = '11000000-0000-0000-0000-000000000001' and name = 'employee'$$,
  'a normal tenant role can be assigned to an employee'
);

select is(
  (select count(*)::integer from public.employee_role_assignments where employee_id = '31000000-0000-0000-0000-000000000001'),
  1,
  'the employee role assignment is stored'
);

select throws_ok(
  $$insert into public.employee_role_assignments(tenant_id, employee_id, role_id)
    select '11000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', id
    from public.roles where tenant_id = '11000000-0000-0000-0000-000000000001' and name = 'owner'$$,
  'P0001',
  'Company ownership must be managed from owner membership settings',
  'owner access cannot be assigned from an employee profile'
);

select is(
  (select count(*)::integer from pg_trigger where tgname = 'sync_employee_role_to_membership' and not tgisinternal),
  1,
  'role changes have a membership synchronization trigger'
);

select is(
  (select count(*)::integer from pg_trigger where tgname = 'sync_employee_roles_after_account_link' and not tgisinternal),
  1,
  'pending roles synchronize when an employee account is linked'
);

select is(
  (select count(*)::integer from pg_trigger where tgname = 'audit_employee_role_assignments' and not tgisinternal),
  1,
  'employee role assignment changes are audited'
);

select * from finish();
rollback;

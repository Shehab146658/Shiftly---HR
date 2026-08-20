begin;
select no_plan();

select has_table('public', 'employee_managers', 'effective-dated multi-manager relationships exist');
select has_function('public', 'next_tenant_entity_code', array['uuid','text'], 'tenant-scoped automatic code generation exists');
select has_function('public', 'set_employee_managers', array['uuid','uuid[]'], 'guarded multi-manager assignment exists');
select has_function('public', 'set_team_members', array['uuid','uuid[]'], 'guarded selective team membership exists');
select ok((select relrowsecurity from pg_class where oid = 'public.employee_managers'::regclass), 'employee manager relationships use RLS');
select has_trigger('public', 'branches', 'branches_automatic_code', 'branches receive automatic codes');
select has_trigger('public', 'teams', 'teams_automatic_code', 'teams receive automatic codes');
select has_trigger('public', 'employees', 'employees_automatic_code', 'employees receive automatic codes');
select has_trigger('public', 'shift_templates', 'shift_templates_automatic_code', 'shift templates receive automatic codes');
select has_trigger('public', 'payroll_periods', 'payroll_periods_automatic_code', 'payroll periods receive automatic codes');
select has_trigger('public', 'bonus_policies', 'bonus_policies_automatic_code', 'bonus policies receive automatic codes');
select has_trigger('public', 'sales_targets', 'sales_targets_automatic_code', 'sales targets receive automatic codes');
select has_trigger('public', 'attendance_devices', 'attendance_devices_automatic_code', 'attendance devices receive automatic codes');
select ok(has_function_privilege('authenticated', 'public.set_employee_managers(uuid,uuid[])', 'EXECUTE'), 'authenticated users can call guarded manager assignment');
select ok(not has_function_privilege('anon', 'public.set_employee_managers(uuid,uuid[])', 'EXECUTE'), 'anonymous manager assignment is blocked');

insert into public.tenants(id, slug, name_en, status)
values ('1b000000-0000-0000-0000-000000000001', 'feedback-foundations', 'Feedback Foundations', 'active');

insert into public.branches(id, tenant_id, name_en) values
  ('2b000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000001', 'Main Branch'),
  ('2b000000-0000-0000-0000-000000000002', '1b000000-0000-0000-0000-000000000001', 'Second Branch');
insert into public.teams(id, tenant_id, branch_id, name_en)
values ('2b000000-0000-0000-0000-000000000011', '1b000000-0000-0000-0000-000000000001', '2b000000-0000-0000-0000-000000000001', 'Operations');
insert into public.shift_templates(id, tenant_id, name_en, start_time, end_time)
values ('2b000000-0000-0000-0000-000000000021', '1b000000-0000-0000-0000-000000000001', 'Day shift', '09:00', '17:00');
insert into public.payroll_periods(id, tenant_id, name, period_start, period_end)
values ('2b000000-0000-0000-0000-000000000031', '1b000000-0000-0000-0000-000000000001', 'August 2026', '2026-08-01', '2026-08-31');
insert into public.bonus_policies(id, tenant_id, name_en, bonus_basis, tiers, effective_from)
values ('2b000000-0000-0000-0000-000000000041', '1b000000-0000-0000-0000-000000000001', 'Standard bonus', 'fixed_amount', '[{"min_percentage":100,"value":500}]'::jsonb, '2026-08-01');
insert into public.sales_targets(id, tenant_id, name, period_start, period_end, scope_type, branch_id, target_amount, bonus_policy_id)
values ('2b000000-0000-0000-0000-000000000051', '1b000000-0000-0000-0000-000000000001', 'Main August target', '2026-08-01', '2026-08-31', 'branch', '2b000000-0000-0000-0000-000000000001', 100000, '2b000000-0000-0000-0000-000000000041');
insert into public.attendance_devices(id, tenant_id, branch_id, name)
values ('2b000000-0000-0000-0000-000000000061', '1b000000-0000-0000-0000-000000000001', '2b000000-0000-0000-0000-000000000001', 'Front desk clock');

select is((select code from public.branches where id = '2b000000-0000-0000-0000-000000000001'), 'BR-001', 'the first branch code is generated');
select is((select code from public.branches where id = '2b000000-0000-0000-0000-000000000002'), 'BR-002', 'automatic branch codes increment within the company');
select is((select code from public.teams where id = '2b000000-0000-0000-0000-000000000011'), 'TM-001', 'team codes are generated');
select is((select code from public.shift_templates where id = '2b000000-0000-0000-0000-000000000021'), 'SH-001', 'shift codes are generated');
select is((select code from public.payroll_periods where id = '2b000000-0000-0000-0000-000000000031'), 'PAY-0001', 'payroll codes are generated');
select is((select code from public.bonus_policies where id = '2b000000-0000-0000-0000-000000000041'), 'BON-001', 'bonus policy codes are generated');
select is((select code from public.sales_targets where id = '2b000000-0000-0000-0000-000000000051'), 'TGT-0001', 'sales target codes are generated');
select is((select code from public.attendance_devices where id = '2b000000-0000-0000-0000-000000000061'), 'DEV-001', 'attendance device codes are generated');

insert into auth.users(id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values ('4b000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'feedback-owner@example.test', 'x', now(), '{}', '{"full_name":"Feedback Owner"}');
insert into public.memberships(id, tenant_id, user_id, status, is_owner, joined_at)
values ('5b000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000001', '4b000000-0000-0000-0000-000000000001', 'active', false, now());
insert into public.membership_roles(membership_id, role_id)
select '5b000000-0000-0000-0000-000000000001', id from public.roles
where tenant_id = '1b000000-0000-0000-0000-000000000001' and name = 'hr_admin';

insert into public.employees(id, tenant_id, name_en, branch_id, status) values
  ('3b000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000001', 'Team Member', '2b000000-0000-0000-0000-000000000001', 'active'),
  ('3b000000-0000-0000-0000-000000000002', '1b000000-0000-0000-0000-000000000001', 'First Manager', '2b000000-0000-0000-0000-000000000001', 'active'),
  ('3b000000-0000-0000-0000-000000000003', '1b000000-0000-0000-0000-000000000001', 'Second Manager', '2b000000-0000-0000-0000-000000000001', 'active');

select is((select employee_code from public.employees where id = '3b000000-0000-0000-0000-000000000001'), 'EMP-0001', 'employee codes are generated automatically');

select set_config('request.jwt.claim.sub', '4b000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select is(
  public.set_employee_managers(
    '3b000000-0000-0000-0000-000000000001',
    array['3b000000-0000-0000-0000-000000000002','3b000000-0000-0000-0000-000000000003']::uuid[]
  ),
  2,
  'an authorized HR user can assign multiple managers'
);
select is(
  public.set_team_members(
    '2b000000-0000-0000-0000-000000000011',
    array['3b000000-0000-0000-0000-000000000001','3b000000-0000-0000-0000-000000000002']::uuid[]
  ),
  2,
  'an authorized HR user can select specific team members'
);
reset role;

select is((select count(*)::integer from public.employee_managers where employee_id = '3b000000-0000-0000-0000-000000000001' and effective_to is null), 2, 'both manager relationships are active');
select is((select manager_employee_id from public.employees where id = '3b000000-0000-0000-0000-000000000001'), '3b000000-0000-0000-0000-000000000002'::uuid, 'the first selected manager remains the primary manager');
select ok(public.is_employee_manager('3b000000-0000-0000-0000-000000000001', '3b000000-0000-0000-0000-000000000003'), 'secondary managers resolve through approval workflows');
select is((select count(*)::integer from public.employees where team_id = '2b000000-0000-0000-0000-000000000011'), 2, 'only the selected employees join the team');
select is((select description from public.permissions where key = 'tenant.read'), 'View the company profile, identity, timezone, and operating settings', 'company-view permission language is clear');
select is((select description from public.permissions where key = 'tenant.update'), 'Edit the company profile and core company-wide settings', 'company-management permission language is clear');

select * from finish();
rollback;
